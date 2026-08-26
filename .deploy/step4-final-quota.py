import datetime as dt
import json
import os
import urllib.parse
import requests
from google.oauth2 import service_account
from google.auth.transport.requests import Request

project = os.environ['FIREBASE_PROJECT_ID']
if project != 'soridraw-app-866a5':
    raise SystemExit('PROJECT_PIN_MISMATCH')
creds = service_account.Credentials.from_service_account_file(
    os.environ['GOOGLE_APPLICATION_CREDENTIALS'],
    scopes=['https://www.googleapis.com/auth/cloud-platform'],
)
creds.refresh(Request())
headers = {
    'Authorization': f'Bearer {creds.token}',
    'X-Goog-User-Project': project,
    'Accept': 'application/json',
}
now = dt.datetime.now(dt.timezone.utc)
kst = dt.timezone(dt.timedelta(hours=9))
start = now.astimezone(kst).replace(hour=0, minute=0, second=0, microsecond=0).astimezone(dt.timezone.utc)


def metric(candidates):
    last = (candidates[0], 0, 0)
    for name in candidates:
        params = {
            'filter': f'metric.type = "{name}"',
            'interval.startTime': start.isoformat().replace('+00:00', 'Z'),
            'interval.endTime': now.isoformat().replace('+00:00', 'Z'),
            'view': 'FULL',
            'pageSize': '1000',
        }
        response = requests.get(
            f'https://monitoring.googleapis.com/v3/projects/{project}/timeSeries?{urllib.parse.urlencode(params)}',
            headers=headers,
            timeout=20,
        )
        if response.status_code in (400, 404):
            continue
        response.raise_for_status()
        total = 0
        points = 0
        for series in response.json().get('timeSeries', []):
            for point in series.get('points', []):
                raw = point.get('value', {}).get('int64Value', point.get('value', {}).get('doubleValue', 0))
                try:
                    total += max(0, float(raw))
                except Exception:
                    pass
                points += 1
        last = (name, round(total), points)
        if points:
            return last
    return last


reads = metric(['firestore.googleapis.com/document/read_ops_count', 'firestore.googleapis.com/document/read_count'])
writes = metric(['firestore.googleapis.com/document/write_ops_count', 'firestore.googleapis.com/document/write_count'])
deletes = metric(['firestore.googleapis.com/document/delete_ops_count', 'firestore.googleapis.com/document/delete_count'])
safe_read = min(10000, max(0, 50000 - reads[1] - 10000))
result = {
    'kstDate': now.astimezone(kst).date().isoformat(),
    'reads': reads[1],
    'writes': writes[1],
    'deletes': deletes[1],
    'safeReadCap': safe_read,
    'requiredReads': 2500,
}
print('STEP4_FINAL_QUOTA=' + json.dumps(result, ensure_ascii=False))
if reads[2] == 0 or writes[2] == 0 or safe_read < 2500:
    raise SystemExit('STEP4_FINAL_QUOTA_BLOCKED')
print('STEP4_FINAL_QUOTA_GATE=PASS')
