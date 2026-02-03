import type { Hono } from "hono";
import { ZodError } from "zod";
import { getPart } from "../storage/partParser";
import { partIdSchema, validateParam } from "../validation";

export function registerPartRoutes(app: Hono) {
  app.get("/api/parts/:id", async (c) => {
    let partID: string;
    try {
      partID = validateParam(partIdSchema, c.req.param("id"));
    } catch (e) {
      if (e instanceof ZodError) {
        return c.json({ error: "VALIDATION_ERROR", message: e.message }, 400);
      }
      throw e;
    }
    
    const part = await getPart(partID);
    
    if (!part) {
      return c.json({ error: "PART_NOT_FOUND", message: `Part '${partID}' not found` }, 404);
    }
    
    return c.json(part);
  });
}
