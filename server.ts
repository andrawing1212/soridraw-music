import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import admin from 'firebase-admin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
try {
  const configPath = path.resolve(__dirname, 'firebase-applet-config.json');

  if (!admin.apps.length) {
    if (process.env.FIREBASE_PRIVATE_KEY) {
      let projectId = "soridraw-app-866a5";

      if (fs.existsSync(configPath)) {
        const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (firebaseConfig?.projectId) {
          projectId = firebaseConfig.projectId;
        }
      }

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail: "firebase-adminsdk-fbsvc@soridraw-app-866a5.iam.gserviceaccount.com",
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });

      console.log("[Admin SDK] Initialized with SERVICE ACCOUNT:", projectId);
    } else if (fs.existsSync(configPath)) {
      const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      console.log("[Admin SDK] Project ID from config:", firebaseConfig.projectId);

      admin.initializeApp({
        projectId: firebaseConfig.projectId,
      });

      console.log("[Admin SDK] Initialized with projectId only (no private key found)");
    } else {
      admin.initializeApp();
      console.log("[Admin SDK] Initialized with ADC fallback");
    }
  }
} catch (error) {
  console.error("[Admin SDK] Initialization Error:", error);
}

const db = admin.firestore();
const authClient = admin.auth();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Force Logout API
  app.post("/api/admin/force-logout", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No token provided" });
    }

    const idToken = authHeader.split(" ")[1];
    
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const uid = decodedToken.uid;

      // Check if requester is admin
      const adminSnap = await db.collection('users').doc(uid).get();
      if (!adminSnap.exists || adminSnap.data()?.role !== 'admin') {
        return res.status(403).json({ error: "Forbidden: Not an admin" });
      }

      const { targetUid } = req.body;
      if (!targetUid) {
        return res.status(400).json({ error: "Target UID is required" });
      }

      // 1. Revoke refresh tokens
      await admin.auth().revokeRefreshTokens(targetUid);

      // 2. Update Firestore doc
      await db.collection('users').doc(targetUid).update({
        forceLogoutAt: admin.firestore.FieldValue.serverTimestamp(),
        forceLogoutReason: "관리자 강제 로그아웃"
      });

      console.log(`[Admin API] Force logout executed for: ${targetUid} by: ${uid}`);

      return res.json({
        success: true,
        message: "Force logout executed"
      });

    } catch (error) {
      console.error("[Admin API] Force Logout Error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);

    // SPA fallback for development
    app.get('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = await fs.promises.readFile(
          path.resolve(__dirname, 'index.html'),
          'utf-8'
        );
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    
    // SPA fallback for production
    app.get('*', (req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('index.html not found in dist folder. Please run build first.');
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
