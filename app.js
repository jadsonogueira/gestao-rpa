// app.js (ESM)
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

// Rotas
import ingestRoutes from "./routes/ingest.js";
// import outras rotas aqui, ex.: import processesRoutes from "./routes/processes.js";

const app = express();

// Middlewares
app.use(helmet());
app.use(cors());
app.use(morgan("tiny"));
app.use(express.json({ limit: "20mb" }));

// Rotas
app.use("/api/ingest", ingestRoutes);
// app.use("/api/processes", processesRoutes);

app.get("/health", (_req, res) => res.json({ ok: true }));

export default app;
