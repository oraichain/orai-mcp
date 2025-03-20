import { z } from "zod";

// Type for the dynamic JSON Schema (simplified)
export type DynamicJsonSchema = {
  type: "object";
  properties: Record<string, { type: string; description?: string }>;
  required?: string[];
  additionalProperties?: boolean;
  $schema?: string;
};

// Function to convert JSON Schema to Zod schema
export function jsonSchemaToZod(
  jsonSchema: DynamicJsonSchema,
): z.ZodObject<
  any,
  "strip",
  z.ZodTypeAny,
  { [x: string]: any },
  { [x: string]: any }
> {
  // Create the shape object for z.object()
  const shape: Record<string, z.ZodTypeAny> = {};

  // Convert each property
  for (const [propName, propSchema] of Object.entries(jsonSchema.properties)) {
    let zodType: z.ZodTypeAny;

    // Map JSON Schema types to Zod types
    switch (propSchema.type) {
      case "string":
        zodType = z.string();
        break;
      case "number":
        zodType = z.number();
        break;
      case "boolean":
        zodType = z.boolean();
        break;
      case "object":
        zodType = z.object({}); // Basic object, could be recursive
        break;
      case "array":
        zodType = z.array(z.any()); // Basic array, could be recursive
        // Add more type mappings as needed
        break;
      default:
        throw new Error(`Unsupported type: ${propSchema.type}`);
    }

    // Add description if present
    if (propSchema.description) {
      zodType = zodType.describe(propSchema.description);
    }

    // Check if property is optional
    if (!jsonSchema.required?.includes(propName)) {
      zodType = zodType.optional();
    }

    shape[propName] = zodType;
  }

  // Create the base object schema
  let result: any = z.object(shape);

  // Apply additionalProperties: false with strict()
  if (jsonSchema.additionalProperties === false) {
    result = result.strict();
  }

  return result;
}
