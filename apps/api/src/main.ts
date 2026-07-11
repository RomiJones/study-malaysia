import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module.js";
import { loadEnvFiles } from "./config/env.js";

loadEnvFiles();

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  app.setGlobalPrefix("api");
  const rootInfo = {
    name: "StudyMY API",
    status: "ok",
    apiBase: "/api",
    endpoints: ["/api/status", "/api/universities", "/api/programs"]
  };
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.get("/", (_request: unknown, response: { json: (body: unknown) => void }) => {
    response.json(rootInfo);
  });
  expressApp.get("/health", (_request: unknown, response: { json: (body: unknown) => void }) => {
    response.json({
      status: "ok",
      service: "studymy-api"
    });
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false
    })
  );

  const port = Number(process.env.API_PORT || 3000);
  await app.listen(port);
  console.log(`StudyMY API running on http://localhost:${port}/api`);
}

bootstrap();
