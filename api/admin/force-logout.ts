import { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    
    if (process.env.FIREBASE_PRIVATE_KEY) {
      let projectId = "soridraw-app-866a5";
      if (fs.existsSync(configPath)) {
        const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (firebaseConfig?.projectId) {
          projectId = firebaseConfig.projectId;
        }
      }
      
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || "firebase-adminsdk-fbsvc@soridraw-app-866a5.iam.gserviceaccount.com";
      
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
      console.log("[Admin SDK] Initialized with SERVICE ACCOUNT in serverless:", projectId);
    } else if (fs.existsSync(configPath)) {
      const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      admin.initializeApp({
        projectId: firebaseConfig.projectId,
      });
      console.log("[Admin SDK] Initialized with projectId in serverless:", firebaseConfig.projectId);
    } else {
      admin.initializeApp();
      console.log("[Admin SDK] Initialized with ADC fallback in serverless");
    }
  } catch (error) {
    console.error("[Admin SDK] Initialization Error in serverless:", error);
  }
}

const db = admin.firestore();
const authClient = admin.auth();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS configuration if needed, but for same-origin it should be fine
  // Vercel handles standard requests.
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  console.log("[ForceLogout API] Received request in Serverless Function");
  
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.warn("[ForceLogout API] Unauthorized attempt: Missing or invalid header");
    return res.status(401).json({ error: "Missing or invalid authorization header" });
  }

  const idToken = authHeader.split('Bearer ')[1];
  const { targetUid, disableUser } = req.body;

  if (!targetUid) {
    console.warn("[ForceLogout API] Bad request: Missing targetUid");
    return res.status(400).json({ error: "Missing targetUid" });
  }

  try {
    console.log("[ForceLogout API] Step 1: Verifying requester admin token...");
    const decodedToken = await authClient.verifyIdToken(idToken);
    const requesterUid = decodedToken.uid;
    console.log("[ForceLogout API] Requester UID:", requesterUid);
    
    const userDoc = await db.collection('users').doc(requesterUid).get();
    const userData = userDoc.data();

    if (!userData || userData.role !== 'admin') {
      console.warn("[ForceLogout API] Forbidden: Requester is not an admin", { requesterUid, role: userData?.role });
      return res.status(403).json({ error: "Unauthorized: Admin privileges required" });
    }

    console.log("[ForceLogout API] Step 2: Revoking refresh tokens for target:", targetUid);
    await authClient.revokeRefreshTokens(targetUid);
    console.log("[ForceLogout API] Revoke refresh tokens SUCCESS");
    
    console.log("[ForceLogout API] Step 3: Updating Firestore signal for target:", targetUid);
    const targetUserRef = db.collection('users').doc(targetUid);
    await targetUserRef.update({
      forceLogoutAt: admin.firestore.FieldValue.serverTimestamp(),
      forceLogoutReason: 'admin_forced'
    });
    console.log("[ForceLogout API] Firestore update SUCCESS");

    // Verify the field was actually written
    const verifySnap = await targetUserRef.get();
    console.log("[ForceLogout API] Final State Check (forceLogoutAt exists):", !!verifySnap.data()?.forceLogoutAt);
    
    let message = `Successfully revoked tokens and sent logout signal for user ${targetUid}`;

    console.log("[ForceLogout API] Step 4: Account status update (disableUser):", disableUser);
    if (disableUser) {
      await authClient.updateUser(targetUid, { disabled: true });
      console.log("[ForceLogout API] Account DISABLE SUCCESS");
      message += " and disabled the account";
    }

    console.log("[ForceLogout API] ALL STEPS COMPLETED SUCCESSFULLY");
    return res.status(200).json({ success: true, message });
  } catch (error: any) {
    console.error("[ForceLogout API] ERROR during execution:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}
