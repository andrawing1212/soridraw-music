#!/usr/bin/env python3
"""Inventory only shared SORIDRAW Firebase Rules/Functions metadata (no data reads)."""
import hashlib
import json
import os
import subprocess
import sys
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

PROJECT = "soridraw-app-866a5"  # NEVER infer from credentials or Hosting project.
REGION = "asia-northeast3"
FUNCTIONS = (
    "syncMusicNoteStructureVersion",
    "syncMusicNoteFolderStateV2Version",
)
API_RULES = "https://firebaserules.googleapis.com/v1"
API_FUNCTIONS = "https://cloudfunctions.googleapis.com"


def read_json(url, token):
    request = Request(url, headers={"Authorization": "Bearer " + token, "Accept": "application/json"})
    try:
        with urlopen(request, timeout=20) as response:
            return response.status, json.load(response)
    except HTTPError as exc:
        return exc.code, None  # Never print response bodies, tokens, or private metadata.
    except (URLError, TimeoutError):
        return "NETWORK_ERROR", None
    except (json.JSONDecodeError, UnicodeDecodeError):
        return "INVALID_RESPONSE", None


def rules_inventory(token):
    result = {"release_status": "UNVERIFIED", "source_status": "UNVERIFIED"}
    status, release = read_json(f"{API_RULES}/projects/{PROJECT}/releases/cloud.firestore", token)
    result["release_http"] = status
    if status != 200 or not isinstance(release, dict):
        return result
    result["release_status"] = "FOUND"
    result["release_name"] = release.get("name")
    ruleset_name = release.get("rulesetName", "")
    if not ruleset_name.startswith(f"projects/{PROJECT}/rulesets/"):
        result["source_status"] = "PROJECT_MISMATCH_OR_MISSING"
        return result
    result["ruleset_name"] = ruleset_name
    source_status, ruleset = read_json(f"{API_RULES}/{ruleset_name}", token)
    result["ruleset_http"] = source_status
    if source_status != 200 or not isinstance(ruleset, dict):
        return result
    sources = ruleset.get("source", {}).get("files", [])
    if not isinstance(sources, list) or not sources:
        result["source_status"] = "EMPTY_OR_UNSUPPORTED"
        return result
    rules_text = "\n".join(str(item.get("content", "")) for item in sources if isinstance(item, dict))
    result["source_status"] = "VERIFIED"
    result["source_sha256"] = hashlib.sha256(rules_text.encode("utf-8")).hexdigest()
    result["has_legacy_parent_rule"] = "match /user_structures/{uid} {" in rules_text
    result["has_v2_folder_rule"] = "match /user_structures/{uid}/folder_state/{stateId} {" in rules_text
    return result


def function_inventory(name, token):
    base = f"projects/{PROJECT}/locations/{REGION}/functions/{name}"
    result = {"name": name, "generation": "UNVERIFIED", "metadata_status": "UNVERIFIED"}
    for generation in ("v1", "v2"):
        prefix = f"{API_FUNCTIONS}/{generation}"
        status, data = read_json(f"{prefix}/{base}", token)
        result[f"{generation}_http"] = status
        if status != 200 or not isinstance(data, dict):
            continue
        result["generation"] = generation
        result["metadata_status"] = "FOUND"
        result["deployed_name"] = data.get("name")
        result["region_matches"] = f"/locations/{REGION}/" in data.get("name", "")
        trigger = data.get("eventTrigger") or {}
        source = trigger.get("resource", "") if generation == "v1" else trigger.get("eventFilters", [])
        result["event_type"] = trigger.get("eventType")
        result["event_source"] = source
        result["trigger_region"] = trigger.get("triggerRegion", REGION if generation == "v1" else None)
        result["runtime"] = data.get("runtime") if generation == "v1" else (data.get("buildConfig") or {}).get("runtime")
        result["state"] = data.get("status") if generation == "v1" else data.get("state")
        result["service_account"] = data.get("serviceAccountEmail") if generation == "v1" else (data.get("serviceConfig") or {}).get("serviceAccountEmail")
        result["trigger_service_account"] = trigger.get("serviceAccount")
        iam_http, iam = read_json(f"{prefix}/{base}:getIamPolicy", token)
        result["function_iam_http"] = iam_http
        result["function_iam_roles"] = sorted({str(item.get("role")) for item in (iam or {}).get("bindings", []) if isinstance(item, dict) and item.get("role")}) if iam_http == 200 else []
        result["effective_runtime_permissions"] = "UNVERIFIED"  # A function policy cannot prove SA project-level IAM.
        break
    if result["metadata_status"] != "FOUND":
        result["metadata_status"] = "NOT_FOUND_OR_INACCESSIBLE" if result.get("v1_http") == 404 and result.get("v2_http") == 404 else "UNVERIFIED"
    return result


def main():
    report = {
        "task": "app515-shared-firebase-live-inventory",
        "target_project": PROJECT,
        "target_region": REGION,
        "candidate_pr": 512,
        "candidate_sha": "357686900da3abcbddb6a691d9a5c96f2f36e483",
        "safety": {"firebase_data_reads": 0, "firebase_data_writes": 0, "firebase_deployments": 0, "rules_changes": 0, "function_changes": 0},
        "release_gate": "HOLD",
    }
    exit_code = 0
    try:
        # Reads metadata using existing GitHub Actions service-account identity.
        # Do not rely on credential default project (historically 'soridraw').
        token = subprocess.check_output(["gcloud", "auth", "print-access-token"], text=True, stderr=subprocess.DEVNULL, timeout=20).strip()
        if not token:
            raise RuntimeError("AUTH_TOKEN_UNAVAILABLE")
        report["rules"] = rules_inventory(token)
        report["functions"] = [function_inventory(name, token) for name in FUNCTIONS]
        if report["rules"].get("source_status") != "VERIFIED" or any(f["metadata_status"] == "UNVERIFIED" for f in report["functions"]):
            report["inventory_status"] = "INCOMPLETE"
            exit_code = 2
        else:
            report["inventory_status"] = "RECORDED"
        # This is NOT an authorization to deploy even if V2 metadata exists.
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, FileNotFoundError, RuntimeError) as exc:
        report["inventory_status"] = "UNAVAILABLE"
        report["failure_class"] = type(exc).__name__
        exit_code = 2
    except Exception as exc:
        report["inventory_status"] = "UNAVAILABLE"
        report["failure_class"] = type(exc).__name__
        exit_code = 2
    result_text = json.dumps(report, ensure_ascii=False, indent=2)
    print(result_text)
    path = os.environ.get("APP515_REPORT_PATH")
    if path:
        with open(path, "w", encoding="utf-8") as handle:
            handle.write(result_text + "\n")
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as handle:
            handle.write("## app515 shared Firebase metadata inventory\n\n")
            handle.write(f"- Target: {PROJECT} / {REGION}\n")
            handle.write(f"- Result: {report['inventory_status']} / release HOLD\n")
            handle.write("- Scope: Rules/Functions administrative metadata only; no user documents queried or changed\n")
            handle.write("- See sanitized JSON artifact for per-item HTTP status and metadata\n")
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
