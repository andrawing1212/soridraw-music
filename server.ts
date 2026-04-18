import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import admin from 'firebase-admin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
const firebaseConfig = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'firebase-applet-config.json'), 'utf-8'));

try {
  admin.initializeApp({
    projectId: firebaseConfig.projectId,
  });
  console.log("Firebase Admin initialized successfully");
} catch (error) {
  console.error("Firebase Admin initialization failed:", error);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Force Logout Admin API
  app.post("/api/admin/force-logout", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: "Missing or invalid authorization header" });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const { targetUid, disableUser } = req.body;

    if (!targetUid) {
      return res.status(400).json({ error: "Missing targetUid" });
    }

    try {
      // 1. Verify the requester is an admin
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const requesterUid = decodedToken.uid;
      
      const userDoc = await admin.firestore().collection('users').doc(requesterUid).get();
      const userData = userDoc.data();

      if (!userData || userData.role !== 'admin') {
        return res.status(403).json({ error: "Unauthorized: Admin privileges required" });
      }

      // 2. Perform the force logout (revoke refresh tokens)
      await admin.auth().revokeRefreshTokens(targetUid);
      
      // 3. Signal immediate client-side logout
      await admin.firestore().collection('users').doc(targetUid).update({
        forceLogoutAt: admin.firestore.FieldValue.serverTimestamp(),
        forceLogoutReason: 'admin_forced'
      });
      
      let message = `Successfully revoked tokens and sent logout signal for user ${targetUid}`;

      // 4. Optionally disable the user
      if (disableUser) {
        await admin.auth().updateUser(targetUid, { disabled: true });
        message += " and disabled the account";
      }

      res.json({ success: true, message });
    } catch (error: any) {
      console.error("Error in force-logout API:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
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
