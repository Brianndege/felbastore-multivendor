type VendorWorkflowRequest = "DRAFT" | "PENDING_APPROVAL";

type ValidateProductInput = {
  name: string;
  description: string;
  category: string;
  price: number;
  imageCount: number;
  workflowStatus: VendorWorkflowRequest;
};

export function validateVendorProductInput(input: ValidateProductInput) {
  const errors: string[] = [];

  if (!input.name.trim()) {
    errors.push("Product name is required.");
  }

  if (!input.description.trim()) {
    errors.push("Product description is required.");
  }

  if (!input.category.trim()) {
    errors.push("Product category is required.");
  }

  if (!Number.isFinite(input.price) || input.price <= 0) {
    errors.push("Price must be a valid number greater than 0.");
  }

  if (input.workflowStatus !== "DRAFT" && input.imageCount < 1) {
    errors.push("At least one product image is required before publishing.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function normalizeVendorWorkflowStatus(value: unknown): VendorWorkflowRequest {
  if (typeof value === "string" && value.toUpperCase() === "PENDING_APPROVAL") {
    return "PENDING_APPROVAL";
  }
  return "DRAFT";
}