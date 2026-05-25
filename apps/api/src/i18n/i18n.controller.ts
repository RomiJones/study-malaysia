import { Body, Controller, Get, Headers, Inject, Post, Put, Query, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../common/guards.js";
import { I18N_LOCALE_QUERY_PARAM, I18N_LOCALE_REQUEST_HEADER } from "./i18n.contracts.js";
import { I18nService, type LocaleSwitchInput } from "./i18n.service.js";

@Controller("i18n")
export class I18nController {
  constructor(@Inject(I18nService) private readonly i18nService: I18nService) {}

  @Get("options")
  options(
    @Query(I18N_LOCALE_QUERY_PARAM) queryLocale?: string,
    @Headers(I18N_LOCALE_REQUEST_HEADER) headerLocale?: string
  ) {
    return this.i18nService.getOptions(queryLocale || headerLocale);
  }

  @Post("switch")
  switchLocale(@Body() payload: LocaleSwitchInput) {
    return this.i18nService.switchLocale(payload || {});
  }

  @UseGuards(AuthGuard)
  @Get("preference")
  getPreference(@Req() request: { user: { id: number } }) {
    return this.i18nService.getUserPreference(request.user.id);
  }

  @UseGuards(AuthGuard)
  @Put("preference")
  savePreference(@Req() request: { user: { id: number } }, @Body() payload: LocaleSwitchInput) {
    return this.i18nService.saveUserPreference(request.user.id, payload || {});
  }
}
