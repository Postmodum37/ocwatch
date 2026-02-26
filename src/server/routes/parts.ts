import type { Hono } from "hono";
import { queryPart } from "../storage/queries";
import { toPartMeta } from "../services/parsing";
import { partIdSchema, validateWithResponse } from "../validation";

export function registerPartRoutes(app: Hono) {
  app.get("/api/parts/:id", (c) => {
    const validation = validateWithResponse(partIdSchema, c.req.param("id"), c);
    if (!validation.success) return validation.response;
    const partID = validation.value;

    const row = queryPart(partID);

    if (!row) {
      return c.json({ error: "PART_NOT_FOUND", message: `Part '${partID}' not found`, status: 404 }, 404);
    }

    const part = toPartMeta(row);
    return c.json(part);
  });
}
