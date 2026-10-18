import hostedConfig from "./firebaseConfig.json";

// Public Firebase client configuration published by this project's Hosting site.
// These identify the app; they are not service-account credentials.
export const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || hostedConfig.apiKey,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || hostedConfig.authDomain,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || hostedConfig.projectId,
};
