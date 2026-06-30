import { Controller, Get } from "@nestjs/common";

@Controller()
export class AppController {
  @Get()
  root() {
    return {
      name: "StudyMY API",
      status: "ok",
      apiBase: "/api",
      endpoints: ["/api/status", "/api/universities", "/api/programs"]
    };
  }

  @Get("status")
  status() {
    return {
      status: "ok",
      service: "studymy-api"
    };
  }
}
