import type { Hono } from "hono";
import { getPart } from "../storage/partParser";
import { partIdSchema, validateWithResponse } from "../validation";

export function registerPartRoutes(app: Hono) {
  app.get("/api/parts/:id", async (c) => {
    const validation = validateWithResponse(partIdSchema, c.req.param("id"), c);
    if (!validation.success) return validation.response;
    const partID = validation.value;
    
    const part = await getPart(partID);
    
    if (!part) {
      return c.json({ error: "PART_NOT_FOUND", message: `Part '${partID}' not found`, status: 404 }, 404);
    }
    
    return c.json(part);
  });
}
