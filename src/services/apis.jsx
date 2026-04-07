const BASE_URL = "https://compiler.satyamvatsal.ovh";

// AUTH ENDPOINTS
export const endpoints = {
  SIGNUP_API: BASE_URL + "/auth/signup",
  LOGIN_API: BASE_URL + "/auth/login",
};

// RUN ENDPOINTS
export const runEndpoints = {
  RUN_API: BASE_URL + "/run",
};

// COLLABORATION ENDPOINTS
export const collabEndpoints = {
  WS_URL: BASE_URL + "/ws-compiler",
  JOIN_ROOM_API: BASE_URL + "/collab/join",
  CREATE_ROOM_API: BASE_URL + "/collab/info",
};
