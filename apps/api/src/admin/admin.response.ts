export function adminOk<T>(data: T, message = "ok") {
  return { success: true, message, data };
}
