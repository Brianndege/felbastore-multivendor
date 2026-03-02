export const isProductApprovalRequired = (): boolean => {
  return process.env.PRODUCT_APPROVAL_REQUIRED !== "false";
};

export const getProductCreateModerationState = () => {
  if (isProductApprovalRequired()) {
    return {
      isApproved: false,
      status: "pending",
    };
  }

  return {
    isApproved: true,
    status: "active",
  };
};

export const getProductEditModerationState = () => {
  if (isProductApprovalRequired()) {
    return {
      isApproved: false,
      status: "pending",
    };
  }

  return {
    isApproved: true,
    status: "active",
  };
};
