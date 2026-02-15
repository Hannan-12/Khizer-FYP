import axios from "axios";
import { auth } from "./firebase";

const API_BASE = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: API_BASE,
});

api.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export async function createAnalysis({ aoiGeojson, startDate, endDate, cropType, season }) {
  const response = await api.post("/api/analyze", {
    aoi_geojson: aoiGeojson,
    start_date: startDate,
    end_date: endDate,
    crop_type: cropType || null,
    season: season || null,
  });
  return response.data;
}

export async function getAnalysisResult(jobId) {
  const response = await api.get(`/api/result/${jobId}`);
  return response.data;
}

export async function listAnalysisJobs() {
  const response = await api.get("/api/jobs");
  return response.data;
}

export default api;
