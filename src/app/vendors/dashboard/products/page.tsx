"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useCallback, ChangeEvent, DragEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { DEFAULT_CATEGORIES } from "@/lib/categories";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  comparePrice?: number;
  currency: string;
  inventory: number;
  sku: string;
  category: string;
  status: "active" | "inactive" | "low_stock";
  images: string[];
}

type PaymentMethodKind = "CARD" | "MPESA" | "BANK_TRANSFER" | "WALLET";

type VendorPaymentMethod = {
  id: string;
  methodKind: PaymentMethodKind;
  label: string;
  config?: string | null;
  approvalStatus: "pending_admin" | "approved" | "rejected";
  isActive: boolean;
  rejectionReason?: string | null;
  createdAt: string;
};

type BulkUploadRowError = {
  row: number;
  field: string;
  errorCode?: string;
  message: string;
};

type VendorNotification = {
  id: string;
  type?: string | null;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};

type NotificationResponse = {
  notifications: VendorNotification[];
  unreadCount: number;
};

type ProductFormState = {
  name: string;
  description: string;
  price: number;
  comparePrice: number;
  currency: string;
  inventory: number;
  sku: string;
  category: string;
  status: Product["status"];
  images: File[];
  existingImages: string[];
};

const EMPTY_PRODUCT_FORM: ProductFormState = {
  name: "",
  description: "",
  price: 0,
  comparePrice: 0,
  currency: "KES",
  inventory: 0,
  sku: "",
  category: "",
  status: "active",
  images: [],
  existingImages: [],
};

const PRODUCT_WIZARD_STEPS = ["Basic Info", "Pricing", "Inventory", "Media", "Review"];
const SUGGESTED_TAGS = ["new", "trending", "gift", "premium", "eco", "best-seller", "limited"];

export default function VendorProductsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const bulkUploadInputRef = useRef<HTMLInputElement | null>(null);
  const imageUploadInputRef = useRef<HTMLInputElement | null>(null);
  const imageCameraInputRef = useRef<HTMLInputElement | null>(null);
  const [lastBulkRows, setLastBulkRows] = useState<Array<Record<string, unknown>>>([]);
  const [lastBulkErrors, setLastBulkErrors] = useState<BulkUploadRowError[]>([]);
  const [notifications, setNotifications] = useState<VendorNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const [markingIds, setMarkingIds] = useState<string[]>([]);
  const [vendorPaymentMethods, setVendorPaymentMethods] = useState<VendorPaymentMethod[]>([]);
  const [isLoadingPaymentMethods, setIsLoadingPaymentMethods] = useState(false);
  const [isSavingPaymentMethod, setIsSavingPaymentMethod] = useState(false);
  const [isLinkingPaymentMethods, setIsLinkingPaymentMethods] = useState(false);
  const [selectedProductIdForPayments, setSelectedProductIdForPayments] = useState("");
  const [selectedPaymentMethodIds, setSelectedPaymentMethodIds] = useState<string[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [categorySearch, setCategorySearch] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [showPublishSuccess, setShowPublishSuccess] = useState(false);
  const [paymentMethodForm, setPaymentMethodForm] = useState({
    methodKind: "MPESA" as PaymentMethodKind,
    label: "",
    config: "",
  });

  const [form, setForm] = useState<ProductFormState>(EMPTY_PRODUCT_FORM);
  const debouncedProductSearch = useDebouncedValue(productSearch, 300);
  const debouncedCategorySearch = useDebouncedValue(categorySearch, 200);
  const isProductSearchPending = productSearch !== debouncedProductSearch;

  useEffect(() => {
    if (status === "loading") return;

    if (!session) {
      router.push("/auth/login");
      return;
    }

    if (!session.user || session.user.role !== "vendor") {
      router.push("/");
      return;
    }

    fetchProducts();
    fetchNotifications();
    fetchVendorPaymentMethods();
  }, [session, status, router]);

  const fetchProducts = async () => {
    try {
      const res = await fetch("/api/vendor/products");
      if (!res.ok) throw new Error("Failed to fetch products");
      const data = await res.json();
      setProducts(data);
    } catch (err) {
      console.error(err);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchNotifications = async () => {
    setNotificationsLoading(true);
    try {
      const res = await fetch("/api/notifications?limit=10");
      const payload = res.ok ? ((await res.json()) as NotificationResponse) : null;
      setNotifications(payload?.notifications || []);
      setUnreadCount(payload?.unreadCount || 0);
    } catch (error) {
      console.error(error);
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setNotificationsLoading(false);
    }
  };

  const fetchVendorPaymentMethods = async () => {
    setIsLoadingPaymentMethods(true);
    try {
      const res = await fetch("/api/vendor/payment-methods");
      if (!res.ok) throw new Error("Failed to fetch payment methods");
      const payload = await res.json();
      setVendorPaymentMethods(Array.isArray(payload?.methods) ? payload.methods : []);
    } catch (error) {
      console.error(error);
      setVendorPaymentMethods([]);
    } finally {
      setIsLoadingPaymentMethods(false);
    }
  };

  const getCsrfHeaders = () => ({
    "Content-Type": "application/json",
    Origin: window.location.origin,
    Referer: window.location.href,
  });

  const submitPaymentMethodRequest = async () => {
    if (!paymentMethodForm.label.trim()) {
      toast.error("Payment method label is required");
      return;
    }

    setIsSavingPaymentMethod(true);
    try {
      const res = await fetch("/api/vendor/payment-methods", {
        method: "POST",
        headers: getCsrfHeaders(),
        body: JSON.stringify({
          methodKind: paymentMethodForm.methodKind,
          label: paymentMethodForm.label.trim(),
          config: paymentMethodForm.config.trim() || undefined,
        }),
      });

      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to submit payment method");

      toast.success("Payment method submitted for admin approval");
      setPaymentMethodForm({ methodKind: "MPESA", label: "", config: "" });
      await fetchVendorPaymentMethods();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to submit payment method");
    } finally {
      setIsSavingPaymentMethod(false);
    }
  };

  const updateProductPaymentMethods = async () => {
    if (!selectedProductIdForPayments) {
      toast.error("Select a product first");
      return;
    }

    setIsLinkingPaymentMethods(true);
    try {
      const res = await fetch(`/api/vendor/products/${selectedProductIdForPayments}/payment-methods`, {
        method: "POST",
        headers: getCsrfHeaders(),
        body: JSON.stringify({ vendorPaymentMethodIds: selectedPaymentMethodIds }),
      });

      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to update product payment methods");

      toast.success("Product payment methods updated");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to update product payment methods");
    } finally {
      setIsLinkingPaymentMethods(false);
    }
  };

  const markNotificationRead = async (id: string) => {
    setMarkingIds((prev) => [...prev, id]);

    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: getCsrfHeaders(),
        body: JSON.stringify({ ids: [id] }),
      });

      if (!res.ok) throw new Error("Failed to mark notification as read");

      setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error(error);
      toast.error("Failed to mark notification as read");
    } finally {
      setMarkingIds((prev) => prev.filter((item) => item !== id));
    }
  };

  const markAllNotificationsRead = async () => {
    if (unreadCount === 0) return;

    setIsMarkingAllRead(true);
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: getCsrfHeaders(),
        body: JSON.stringify({ markAllRead: true }),
      });

      if (!res.ok) throw new Error("Failed to mark all notifications as read");

      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error(error);
      toast.error("Failed to mark all notifications as read");
    } finally {
      setIsMarkingAllRead(false);
    }
  };

  // Resize image to max width/height of 800px
  const resizeImage = (file: File, maxWidth = 800, maxHeight = 800): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);

      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target?.result as string;

        img.onload = () => {
          let { width, height } = img;

          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = width * ratio;
            height = height * ratio;
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);

          canvas.toBlob((blob) => {
            if (blob) {
              const resizedFile = new File([blob], file.name, { type: file.type });
              resolve(resizedFile);
            } else {
              reject(new Error("Failed to convert canvas to blob"));
            }
          }, file.type, 0.9);
        };

        img.onerror = (err) => reject(err);
      };

      reader.onerror = (err) => reject(err);
    });
  };

  const handleFormChange = async (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const inputTarget = e.target as HTMLInputElement;
    const files = inputTarget.files;

    if (files && files.length > 0) {
      const resizedFiles = await Promise.all(Array.from(files).map((file) => resizeImage(file)));
      setForm(prev => ({ ...prev, [name]: resizedFiles }));
    } else {
      setForm(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleImageFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) {
      return;
    }

    setUploadingImages(true);
    try {
      const resizedFiles = await Promise.all(Array.from(files).map((file) => resizeImage(file)));
      setForm(prev => ({ ...prev, images: [...prev.images, ...resizedFiles] }));
    } finally {
      setUploadingImages(false);
    }
  };

  const handleImageUploadSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    await handleImageFiles(e.target.files);
    e.target.value = "";
  };

  const handleImageCameraCapture = async (e: ChangeEvent<HTMLInputElement>) => {
    await handleImageFiles(e.target.files);
    e.target.value = "";
  };

  const handleImageDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    await handleImageFiles(e.dataTransfer.files);
  };

  const addTag = (rawTag: string) => {
    const normalized = rawTag.trim().toLowerCase().replace(/\s+/g, "-");
    if (!normalized) {
      return;
    }

    setSelectedTags((prev) => (prev.includes(normalized) ? prev : [...prev, normalized]));
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    setSelectedTags((prev) => prev.filter((item) => item !== tag));
  };

  const removeNewImage = (index: number) => {
    setForm((prev) => ({
      ...prev,
      images: prev.images.filter((_, imageIndex) => imageIndex !== index),
    }));
  };

  const removeExistingImage = (index: number) => {
    setForm(prev => ({
      ...prev,
      existingImages: prev.existingImages.filter((_, imageIndex) => imageIndex !== index),
    }));
  };

  const downloadBulkTemplate = () => {
    const header = [
      "name",
      "description",
      "price",
      "comparePrice",
      "currency",
      "category",
      "subcategory",
      "tags",
      "inventory",
      "sku",
      "status",
      "images",
    ];

    const sampleRows = [
      [
        "Wireless Earbuds",
        "Noise-cancelling earbuds with charging case",
        "4500",
        "5200",
        "KES",
        "Electronics",
        "Audio",
        "earbuds,wireless,audio",
        "50",
        "AUDIO-001",
        "active",
        "https://example.com/image1.jpg|https://example.com/image2.jpg",
      ],
      [
        "Cotton T-Shirt",
        "Soft unisex cotton t-shirt",
        "1200",
        "",
        "KES",
        "Fashion",
        "Clothing",
        "tshirt,cotton,unisex",
        "120",
        "FASH-101",
        "active",
        "https://example.com/tshirt.jpg",
      ],
    ];

    const escapeCell = (value: string) => {
      if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
        return `"${value.replace(/\"/g, '""')}"`;
      }
      return value;
    };

    const rows = [header, ...sampleRows]
      .map((row) => row.map((cell) => escapeCell(String(cell))).join(","))
      .join("\n");

    const blob = new Blob([rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "vendor-products-template.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportFailedRowsCsv = () => {
    if (lastBulkErrors.length === 0 || lastBulkRows.length === 0) {
      toast.error("No failed rows available to export");
      return;
    }

    const errorsByRow = new Map<number, BulkUploadRowError[]>();
    for (const error of lastBulkErrors) {
      const current = errorsByRow.get(error.row) || [];
      current.push(error);
      errorsByRow.set(error.row, current);
    }

    const failedRows = Array.from(errorsByRow.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([rowNumber, errors]) => {
        const sourceRow = lastBulkRows[rowNumber - 2] || {};
        return {
          ...sourceRow,
          validationErrorCodes: errors.map((error) => error.errorCode || "UNKNOWN").join("|"),
          validationErrors: errors.map((error) => `${error.field}: ${error.message}`).join(" | "),
        };
      });

    if (failedRows.length === 0) {
      toast.error("No failed rows available to export");
      return;
    }

    const headers = Array.from(
      failedRows.reduce<Set<string>>((set, row) => {
        Object.keys(row).forEach((key) => set.add(key));
        return set;
      }, new Set<string>())
    );

    const escapeCell = (value: string) => {
      if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
        return `"${value.replace(/\"/g, '""')}"`;
      }
      return value;
    };

    const csv = [
      headers.join(","),
      ...failedRows.map((row) =>
        headers
          .map((header) => {
            const rawValue = row[header as keyof typeof row];
            const value = Array.isArray(rawValue)
              ? rawValue.join("|")
              : rawValue === undefined || rawValue === null
                ? ""
                : String(rawValue);
            return escapeCell(value);
          })
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "vendor-products-failed-rows.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const copyTroubleshootingTips = async () => {
    const tips = [
      "Bulk Upload Troubleshooting Guide",
      "",
      "REQUIRED_NAME: Add a product name",
      "REQUIRED_DESCRIPTION: Add a product description",
      "REQUIRED_CATEGORY: Use a valid category name (e.g., Electronics, Fashion)",
      "INVALID_PRICE: Price must be greater than 0",
      "INVALID_COMPARE_PRICE: Compare price must be a non-negative number",
      "INVALID_INVENTORY: Inventory must be a non-negative number",
      "INVALID_CURRENCY: Use 3-letter currency code (KES, USD, EUR)",
      "INVALID_STATUS: Use active, inactive, or low_stock",
      "DUPLICATE_SKU_IN_FILE: Same SKU appears more than once in uploaded file",
      "SKU_ALREADY_EXISTS: SKU already exists in the system",
      "",
      "Best Practices:",
      "- Use the provided template",
      "- Keep column headers unchanged",
      "- Separate multiple image URLs with |",
      "- Use unique SKUs per product",
    ].join("\n");

    try {
      await navigator.clipboard.writeText(tips);
      toast.success("Troubleshooting tips copied");
    } catch (error) {
      console.error(error);
      toast.error("Unable to copy tips. Please copy manually from the page.");
    }
  };

  const clearDraft = () => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem("vendor.productWizard.draft");
  };

  const persistDraft = useCallback((showToast = false) => {
    if (editingProduct || typeof window === "undefined") {
      return;
    }

    const draftPayload = {
      form: {
        ...form,
        images: [],
      },
      selectedTags,
      wizardStep,
      updatedAt: new Date().toISOString(),
    };

    window.localStorage.setItem("vendor.productWizard.draft", JSON.stringify(draftPayload));
    setDraftSavedAt(draftPayload.updatedAt);
    if (showToast) {
      toast.success("Draft saved");
    }
  }, [editingProduct, form, selectedTags, wizardStep]);

  const loadDraft = () => {
    if (typeof window === "undefined") return false;

    const draft = window.localStorage.getItem("vendor.productWizard.draft");
    if (!draft) {
      return false;
    }

    try {
      const parsed = JSON.parse(draft) as {
        form?: Partial<ProductFormState>;
        selectedTags?: string[];
        wizardStep?: number;
        updatedAt?: string;
      };

      if (parsed.form) {
        setForm({
          ...EMPTY_PRODUCT_FORM,
          ...parsed.form,
          images: [],
          existingImages: Array.isArray(parsed.form.existingImages) ? parsed.form.existingImages : [],
        });
      }

      setSelectedTags(Array.isArray(parsed.selectedTags) ? parsed.selectedTags : []);
      setWizardStep(typeof parsed.wizardStep === "number" ? Math.min(Math.max(parsed.wizardStep, 0), PRODUCT_WIZARD_STEPS.length - 1) : 0);
      setDraftSavedAt(parsed.updatedAt || null);
      return true;
    } catch {
      return false;
    }
  };

  const resetModalState = () => {
    setWizardStep(0);
    setCategorySearch("");
    setTagInput("");
    setSelectedTags([]);
    setDraftSavedAt(null);
    setUploadingImages(false);
    setShowPublishSuccess(false);
  };

  const openAddModal = () => {
    setEditingProduct(null);

    resetModalState();
    if (!loadDraft()) {
      setForm(EMPTY_PRODUCT_FORM);
    }

    setShowModal(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    resetModalState();
    setForm({
      name: product.name,
      description: product.description || "",
      price: product.price,
      comparePrice: product.comparePrice || 0,
      currency: product.currency || "KES",
      inventory: product.inventory,
      sku: product.sku,
      category: product.category,
      status: product.status,
      images: [],
      existingImages: product.images || [],
    });
    setSelectedTags([]);
    setShowModal(true);
  };

  const handleSave = async () => {
    setIsSavingProduct(true);

    try {
      const url = editingProduct ? `/api/vendor/products/${editingProduct.id}` : "/api/vendor/products";
      const method = editingProduct ? "PUT" : "POST";
      let res: Response;

      if (editingProduct) {
        res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            description: form.description,
            price: Number(form.price),
            comparePrice: form.comparePrice ? Number(form.comparePrice) : null,
            currency: form.currency,
            inventory: Number(form.inventory),
            sku: form.sku || null,
            category: form.category,
            status: form.status,
            tags: selectedTags,
            images: form.existingImages,
          }),
        });
      } else {
        const formData = new FormData();
        formData.append("name", form.name);
        formData.append("description", form.description);
        formData.append("price", form.price.toString());
        formData.append("comparePrice", form.comparePrice.toString());
        formData.append("currency", form.currency);
        formData.append("inventory", form.inventory.toString());
        formData.append("sku", form.sku);
        formData.append("category", form.category);
        formData.append("status", form.status);
        formData.append("workflowStatus", "PENDING_APPROVAL");
        formData.append("tags", selectedTags.join(","));
        form.images.forEach(img => formData.append("images", img));
        form.existingImages.forEach(imgUrl => formData.append("existingImages", imgUrl));

        res = await fetch(url, { method, body: formData });
      }

      if (!res.ok) {
        let failureMessage = "Failed to save product";
        try {
          const payload = await res.json();
          failureMessage = payload?.message || payload?.error || failureMessage;
        } catch {
        }
        throw new Error(failureMessage);
      }

      toast.success("Product saved successfully!");
      fetchProducts();
      clearDraft();
      setShowPublishSuccess(!editingProduct);
      setShowModal(false);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Error saving product");
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return;
    try {
      const res = await fetch(`/api/vendor/products/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete product");
      toast.success("Product deleted!");
      fetchProducts();
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete product");
    }
  };

  // Bulk CSV/XLSX Upload
  const handleBulkUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(sheet) as Array<Record<string, unknown>>;

    const normalizedData = jsonData.map((row) => {
      const normalized = { ...row } as Record<string, unknown>;
      if (typeof normalized.images === "string") {
        normalized.images = normalized.images
          .split("|")
          .map((image) => image.trim())
          .filter(Boolean);
      }
      return normalized;
    });

    setLastBulkRows(normalizedData);
    setLastBulkErrors([]);

    try {
      const res = await fetch("/api/vendor/products/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalizedData),
      });

      const payload = await res.json();
      const payloadErrors = Array.isArray(payload?.errors)
        ? (payload.errors as BulkUploadRowError[])
        : [];

      setLastBulkErrors(payloadErrors);

      if (!res.ok) {
        const errorPreview = payloadErrors.length > 0
          ? payloadErrors
              .slice(0, 3)
              .map((err) => `Row ${err.row} [${err.errorCode || "UNKNOWN"}] (${err.field}): ${err.message}`)
              .join(" | ")
          : "Bulk upload failed";
        throw new Error(errorPreview);
      }

      const createdCount = Number(payload?.createdCount ?? 0);
      const validCount = Number(payload?.validCount ?? createdCount);
      const invalidCount = Number(payload?.invalidCount ?? 0);
      const skippedCount = Number(payload?.skippedCount ?? 0);

      toast.success(`Bulk upload completed: ${createdCount} created, ${invalidCount} invalid, ${skippedCount} skipped.`);

      if (invalidCount > 0 && payloadErrors.length > 0) {
        const warningPreview = payloadErrors
          .slice(0, 3)
          .map((err) => `Row ${err.row} [${err.errorCode || "UNKNOWN"}] (${err.field}): ${err.message}`)
          .join(" | ");
        toast.error(`Some rows were rejected. ${warningPreview}`);
      } else if (validCount > createdCount) {
        toast.error("Some valid rows were skipped (likely duplicate records). Check SKU uniqueness.");
      }

      fetchProducts();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Bulk upload failed");
    }
  };

  useEffect(() => {
    if (!showModal || editingProduct) {
      return;
    }

    const timer = window.setTimeout(() => {
      const hasContent =
        form.name.trim() ||
        form.description.trim() ||
        form.category.trim() ||
        form.sku.trim() ||
        form.price > 0 ||
        form.comparePrice > 0 ||
        form.inventory > 0 ||
        form.existingImages.length > 0 ||
        form.images.length > 0 ||
        selectedTags.length > 0;

      if (hasContent) {
        persistDraft();
      }
    }, 900);

    return () => window.clearTimeout(timer);
  }, [showModal, editingProduct, form, selectedTags, wizardStep, persistDraft]);

  const normalizedProductSearch = debouncedProductSearch.trim().toLowerCase();
  const filteredProducts = useMemo(() => {
    if (!normalizedProductSearch) {
      return products;
    }

    return products.filter((product) => {
      const searchable = [
        product.id,
        product.name,
        product.sku,
        product.category,
        product.status,
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(normalizedProductSearch);
    });
  }, [products, normalizedProductSearch]);

  const filteredCategories = useMemo(() => {
    const normalized = debouncedCategorySearch.trim().toLowerCase();
    if (!normalized) {
      return DEFAULT_CATEGORIES;
    }

    return DEFAULT_CATEGORIES.filter((category) =>
      category.name.toLowerCase().includes(normalized)
    );
  }, [debouncedCategorySearch]);

  const wizardErrors = useMemo(() => {
    const errors: string[] = [];

    if (wizardStep === 0) {
      if (!form.name.trim()) errors.push("Product name is required.");
      if (!form.description.trim()) errors.push("Description is required.");
      if (!form.category.trim()) errors.push("Category is required.");
    }

    if (wizardStep === 1) {
      if (Number(form.price) <= 0) errors.push("Price must be greater than 0.");
      if (Number(form.comparePrice) < 0) errors.push("Compare price cannot be negative.");
      if (!form.currency.trim()) errors.push("Currency is required.");
    }

    if (wizardStep === 2) {
      if (Number(form.inventory) < 0) errors.push("Inventory cannot be negative.");
    }

    return errors;
  }, [form, wizardStep]);

  const isCurrentStepValid = wizardErrors.length === 0;

  const nextStep = () => {
    if (!isCurrentStepValid) {
      toast.error(wizardErrors[0]);
      return;
    }

    setWizardStep((prev) => Math.min(prev + 1, PRODUCT_WIZARD_STEPS.length - 1));
  };

  const prevStep = () => {
    setWizardStep((prev) => Math.max(prev - 1, 0));
  };

  const resetWizardAndClose = () => {
    setShowModal(false);
    resetModalState();
  };

  if (status === "loading" || loading) {
    return <div className="container mx-auto px-4 py-4 md:py-8">Loading...</div>;
  }

  const moderationNotifications = notifications.filter(
    (item) => item.type === "product_moderation" || item.title.toLowerCase().includes("product")
  );
  const approvedActivePaymentMethods = vendorPaymentMethods.filter(
    (method) => method.approvalStatus === "approved" && method.isActive
  );

  return (
    <div className="container mx-auto px-4 py-4 md:py-8">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <h1 className="text-3xl font-bold">Your Products</h1>
        <div className="mobile-stack flex flex-wrap gap-2">
          <Button className="touch-target" onClick={openAddModal}>Add Product</Button>
          <Button className="touch-target" type="button" variant="outline" onClick={downloadBulkTemplate}>Download Template</Button>
          <Button className="touch-target" type="button" variant="outline" onClick={copyTroubleshootingTips}>Copy Troubleshooting Tips</Button>
          <Button
            className="touch-target"
            type="button"
            variant="outline"
            onClick={exportFailedRowsCsv}
            disabled={lastBulkErrors.length === 0}
          >
            Export Failed Rows
          </Button>
          <Input
            ref={bulkUploadInputRef}
            type="file"
            accept=".csv, .xlsx"
            onChange={handleBulkUpload}
            className="w-full sm:max-w-[240px]"
          />
        </div>
      </div>

      <div className="mb-4 rounded-md border p-3 text-sm text-gray-600">
        <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-medium">Moderation notifications</p>
          <div className="mobile-stack flex flex-wrap items-center gap-2">
            <Badge variant={unreadCount > 0 ? "destructive" : "outline"}>{unreadCount} unread</Badge>
            <Button className="touch-target" type="button" variant="outline" size="sm" onClick={fetchNotifications} disabled={notificationsLoading}>
              {notificationsLoading ? "Refreshing..." : "Refresh"}
            </Button>
            <Button
              className="touch-target"
              type="button"
              size="sm"
              onClick={markAllNotificationsRead}
              disabled={isMarkingAllRead || unreadCount === 0}
            >
              {isMarkingAllRead ? "Marking..." : "Mark all read"}
            </Button>
          </div>
        </div>
        {moderationNotifications.length > 0 ? (
          <div className="mb-3 space-y-2">
            {moderationNotifications.slice(0, 5).map((item) => (
              <div key={item.id} className="rounded border p-2 bg-white">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{item.title}</p>
                    <p className="text-xs text-gray-600">{item.message}</p>
                    <p className="text-xs text-gray-500">{new Date(item.createdAt).toLocaleString()}</p>
                  </div>
                  {!item.isRead && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => markNotificationRead(item.id)}
                      disabled={markingIds.includes(item.id)}
                    >
                      {markingIds.includes(item.id) ? "Saving..." : "Mark read"}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mb-3 text-xs text-gray-500">No product moderation notifications yet.</p>
        )}

        <p className="font-medium mb-1">Bulk upload best practices</p>
        <p>
          Use the template, keep column names unchanged, separate multiple image URLs with <span className="font-mono">|</span>,
          and use valid category names like Electronics or Fashion for automatic routing.
        </p>
        <div className="mt-3 grid gap-1 text-xs text-gray-500 md:grid-cols-2">
          <p><span className="font-semibold">REQUIRED_NAME</span>: Add a product name</p>
          <p><span className="font-semibold">REQUIRED_DESCRIPTION</span>: Add a product description</p>
          <p><span className="font-semibold">REQUIRED_CATEGORY</span>: Use a valid category name</p>
          <p><span className="font-semibold">INVALID_PRICE</span>: Price must be greater than 0</p>
          <p><span className="font-semibold">INVALID_COMPARE_PRICE</span>: Compare price must be ≥ 0</p>
          <p><span className="font-semibold">INVALID_INVENTORY</span>: Inventory must be ≥ 0</p>
          <p><span className="font-semibold">INVALID_CURRENCY</span>: Use 3-letter code (KES, USD)</p>
          <p><span className="font-semibold">INVALID_STATUS</span>: Use active, inactive, or low_stock</p>
          <p><span className="font-semibold">DUPLICATE_SKU_IN_FILE</span>: SKU appears multiple times in upload</p>
          <p><span className="font-semibold">SKU_ALREADY_EXISTS</span>: SKU already exists in your store</p>
        </div>
      </div>

      <div className="mb-4 rounded-md border p-3 text-sm text-gray-600">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-medium">Vendor payment methods</p>
          <Button type="button" variant="outline" size="sm" onClick={fetchVendorPaymentMethods} disabled={isLoadingPaymentMethods}>
            {isLoadingPaymentMethods ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        <div className="mb-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          <Select
            name="methodKind"
            value={paymentMethodForm.methodKind}
            onValueChange={(value) => setPaymentMethodForm((prev) => ({ ...prev, methodKind: value as PaymentMethodKind }))}
          >
            <SelectTrigger><SelectValue placeholder="Method" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="MPESA">M-Pesa</SelectItem>
              <SelectItem value="CARD">Card</SelectItem>
              <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
              <SelectItem value="WALLET">Wallet</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder="Display label"
            value={paymentMethodForm.label}
            onChange={(event) => setPaymentMethodForm((prev) => ({ ...prev, label: event.target.value }))}
          />
          <Input
            placeholder="Optional config JSON/text"
            value={paymentMethodForm.config}
            onChange={(event) => setPaymentMethodForm((prev) => ({ ...prev, config: event.target.value }))}
          />
          <Button className="touch-target" type="button" onClick={submitPaymentMethodRequest} disabled={isSavingPaymentMethod}>
            {isSavingPaymentMethod ? "Submitting..." : "Submit for Approval"}
          </Button>
        </div>

        {vendorPaymentMethods.length > 0 ? (
          <div className="table-scroll mb-3 rounded border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Method</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendorPaymentMethods.map((method) => (
                  <TableRow key={method.id}>
                    <TableCell>{method.methodKind}</TableCell>
                    <TableCell>{method.label}</TableCell>
                    <TableCell>
                      <Badge variant={method.approvalStatus === "approved" ? "default" : method.approvalStatus === "rejected" ? "destructive" : "outline"}>
                        {method.approvalStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-gray-500">{method.rejectionReason || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="mb-3 text-xs text-gray-500">No payment methods submitted yet.</p>
        )}

        <div className="rounded border p-3">
          <p className="mb-2 font-medium">Link approved methods to product</p>
          <div className="mb-3 grid gap-2 md:grid-cols-2">
            <Select
              value={selectedProductIdForPayments}
              onValueChange={(value) => {
                setSelectedProductIdForPayments(value);
                setSelectedPaymentMethodIds([]);
              }}
            >
              <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
              <SelectContent>
                {products.map((product) => (
                  <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button className="touch-target" type="button" onClick={updateProductPaymentMethods} disabled={isLinkingPaymentMethods || !selectedProductIdForPayments}>
              {isLinkingPaymentMethods ? "Saving..." : "Save Product Payment Methods"}
            </Button>
          </div>

          {approvedActivePaymentMethods.length > 0 ? (
            <div className="grid gap-2 md:grid-cols-2">
              {approvedActivePaymentMethods.map((method) => {
                const checked = selectedPaymentMethodIds.includes(method.id);
                return (
                  <label key={method.id} className="flex items-center gap-2 rounded border px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        setSelectedPaymentMethodIds((prev) =>
                          prev.includes(method.id) ? prev.filter((id) => id !== method.id) : [...prev, method.id]
                        );
                      }}
                    />
                    <span>{method.label} ({method.methodKind})</span>
                  </label>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-gray-500">No approved methods available yet. Submit and wait for admin approval.</p>
          )}
        </div>
      </div>

      <div className="mb-3 rounded-md border p-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900">Product catalog</p>
            <p className="text-xs text-gray-500">
              Search by product name, SKU, category, status, or product ID.
            </p>
          </div>
          <div className="flex w-full max-w-xl flex-col gap-2 sm:flex-row">
            <Input
              placeholder="Search products"
              value={productSearch}
              onChange={(event) => setProductSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  setProductSearch((prev) => prev.trim());
                }
              }}
            />
            {productSearch && (
              <Button
                className="touch-target"
                type="button"
                variant="outline"
                onClick={() => setProductSearch("")}
              >
                Clear
              </Button>
            )}
          </div>
        </div>
        {isProductSearchPending && <p className="mt-2 text-xs text-gray-500">Searching products...</p>}
      </div>

      <div className="table-scroll rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Inventory</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProducts.length > 0 ? filteredProducts.map(product => (
              <TableRow key={product.id}>
                <TableCell>{product.id}</TableCell>
                <TableCell>{product.name}</TableCell>
                <TableCell>{new Intl.NumberFormat('en-KE', { style: 'currency', currency: product.currency || "KES" }).format(product.price)}</TableCell>
                <TableCell>{product.inventory}</TableCell>
                <TableCell>{product.category}</TableCell>
                <TableCell>
                  <Badge variant={product.status === "active" ? "default" : "outline"}>
                    {product.status.replace("_", " ").toUpperCase()}
                  </Badge>
                </TableCell>
                <TableCell className="flex justify-end gap-2 text-right">
                  <Button className="touch-target" variant="ghost" size="sm" onClick={() => openEditModal(product)}>Edit</Button>
                  <Button className="touch-target" variant="ghost" size="sm" onClick={() => handleDelete(product.id)}>Delete</Button>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  {normalizedProductSearch ? "No products match your search" : "No products found"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={showModal}
        onOpenChange={(open) => {
          setShowModal(open);
          if (!open) {
            resetModalState();
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Edit Product" : "Add Product Wizard"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-md border bg-muted/30 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium">Step {wizardStep + 1} of {PRODUCT_WIZARD_STEPS.length}</p>
                <p className="text-xs text-gray-500">{PRODUCT_WIZARD_STEPS[wizardStep]}</p>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {PRODUCT_WIZARD_STEPS.map((step, index) => (
                  <div key={step} className="space-y-1">
                    <div className={`h-1.5 rounded-full ${index <= wizardStep ? "bg-primary" : "bg-gray-200"}`} />
                    <p className={`truncate text-[11px] ${index === wizardStep ? "font-medium text-gray-900" : "text-gray-500"}`}>
                      {step}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {wizardStep === 0 && (
              <div className="space-y-3">
                <Input name="name" value={form.name} onChange={handleFormChange} placeholder="Product name" />
                <Input name="description" value={form.description} onChange={handleFormChange} placeholder="Short description" />

                <div className="space-y-2">
                  <Input
                    placeholder="Search category"
                    value={categorySearch}
                    onChange={(event) => setCategorySearch(event.target.value)}
                  />
                  <Select name="category" value={form.category} onValueChange={(value) => setForm((prev) => ({ ...prev, category: value }))}>
                    <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                    <SelectContent>
                      {filteredCategories.map((category) => (
                        <SelectItem key={category.id} value={category.name}>{category.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Input
                    value={tagInput}
                    placeholder="Add tag and press Enter"
                    onChange={(event) => setTagInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addTag(tagInput);
                      }
                    }}
                  />
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTED_TAGS.map((suggestion) => (
                      <Button
                        key={suggestion}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="touch-target"
                        onClick={() => addTag(suggestion)}
                      >
                        + {suggestion}
                      </Button>
                    ))}
                  </div>
                  {selectedTags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {selectedTags.map((tag) => (
                        <Badge key={tag} variant="outline" className="cursor-pointer" onClick={() => removeTag(tag)}>
                          {tag} ×
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {wizardStep === 1 && (
              <div className="space-y-3">
                <Input type="number" name="price" value={form.price} onChange={handleFormChange} placeholder="Price" />
                <Input type="number" name="comparePrice" value={form.comparePrice} onChange={handleFormChange} placeholder="Compare price" />
                <Select name="currency" value={form.currency} onValueChange={v => setForm(prev => ({ ...prev, currency: v }))}>
                  <SelectTrigger><SelectValue placeholder="Currency" /></SelectTrigger>
                  <SelectContent>
                    {["KES", "USD", "EUR", "GBP", "NGN"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select name="status" value={form.status} onValueChange={v => setForm(prev => ({ ...prev, status: v as Product["status"] }))}>
                  <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="low_stock">Low Stock</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {wizardStep === 2 && (
              <div className="space-y-3">
                <Input type="number" name="inventory" value={form.inventory} onChange={handleFormChange} placeholder="Inventory" />
                <Input name="sku" value={form.sku} onChange={handleFormChange} placeholder="SKU" />
                <div className="rounded-md border bg-muted/30 p-3 text-xs text-gray-600">
                  SKU is optional but recommended for bulk updates and order operations.
                </div>
              </div>
            )}

            {wizardStep === 3 && (
              <div className="space-y-3">
                <div
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => void handleImageDrop(event)}
                  className="rounded-md border border-dashed p-4 text-center"
                >
                  <p className="text-sm font-medium">Drag and drop product images here</p>
                  <p className="mb-3 text-xs text-gray-500">or use quick actions below</p>
                  <div className="mobile-stack flex flex-wrap justify-center gap-2">
                    <Button className="touch-target" type="button" variant="outline" onClick={() => imageUploadInputRef.current?.click()}>
                      Upload Images
                    </Button>
                    <Button className="touch-target" type="button" variant="outline" onClick={() => imageCameraInputRef.current?.click()}>
                      Take Photo
                    </Button>
                  </div>
                </div>

                <input
                  ref={imageUploadInputRef}
                  type="file"
                  name="images"
                  multiple
                  onChange={handleImageUploadSelect}
                  accept="image/*"
                  className="hidden"
                />
                <input
                  ref={imageCameraInputRef}
                  type="file"
                  name="cameraImages"
                  multiple
                  onChange={handleImageCameraCapture}
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                />

                {uploadingImages && <p className="text-xs text-gray-500">Optimizing images...</p>}

                {(form.images.length > 0 || form.existingImages.length > 0) && (
                  <div className="grid grid-cols-3 gap-2">
                    {form.existingImages.map((img, index) => (
                      <div key={img + index} className="relative rounded border p-1">
                        <img src={img} alt="Product" className="h-20 w-full rounded object-cover" />
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="absolute right-1 top-1 h-6 min-h-0 px-2 text-xs"
                          onClick={() => removeExistingImage(index)}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                    {form.images.map((img, index) => (
                      <div key={img.name + index} className="relative rounded border p-1">
                        <img src={URL.createObjectURL(img)} alt={img.name} className="h-20 w-full rounded object-cover" />
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="absolute right-1 top-1 h-6 min-h-0 px-2 text-xs"
                          onClick={() => removeNewImage(index)}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {wizardStep === 4 && (
              <div className="space-y-3 rounded-md border bg-muted/20 p-4 text-sm">
                <p className="font-medium">Review before publishing</p>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <p><span className="font-semibold">Name:</span> {form.name || "-"}</p>
                  <p><span className="font-semibold">Category:</span> {form.category || "-"}</p>
                  <p><span className="font-semibold">Price:</span> {form.price || 0} {form.currency}</p>
                  <p><span className="font-semibold">Inventory:</span> {form.inventory}</p>
                  <p><span className="font-semibold">SKU:</span> {form.sku || "-"}</p>
                  <p><span className="font-semibold">Status:</span> {form.status.replace("_", " ")}</p>
                </div>
                <p className="text-xs text-gray-600">Description: {form.description || "-"}</p>
                {selectedTags.length > 0 && (
                  <p className="text-xs text-gray-600">Tags: {selectedTags.join(", ")}</p>
                )}
                <p className="text-xs text-gray-600">
                  Media files: {form.images.length} new, {form.existingImages.length} existing
                </p>
                {showPublishSuccess && <p className="text-xs font-medium text-green-600">Product published successfully.</p>}
              </div>
            )}

            {wizardErrors.length > 0 && (
              <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-600">
                {wizardErrors[0]}
              </div>
            )}

            <div className="mobile-stack mt-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2">
                {!editingProduct && (
                  <Button className="touch-target" variant="outline" type="button" onClick={() => persistDraft(true)}>
                    Save Draft
                  </Button>
                )}
                {draftSavedAt && !editingProduct && (
                  <p className="self-center text-xs text-gray-500">Last draft: {new Date(draftSavedAt).toLocaleTimeString()}</p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button className="touch-target" variant="outline" type="button" onClick={resetWizardAndClose}>Cancel</Button>
                <Button className="touch-target" type="button" variant="outline" onClick={prevStep} disabled={wizardStep === 0}>Back</Button>
                {wizardStep < PRODUCT_WIZARD_STEPS.length - 1 ? (
                  <Button className="touch-target" type="button" onClick={nextStep} disabled={!isCurrentStepValid}>Next</Button>
                ) : (
                  <Button className="touch-target" type="button" onClick={handleSave} disabled={isSavingProduct || !isCurrentStepValid}>
                    {isSavingProduct ? "Publishing..." : editingProduct ? "Save Changes" : "Publish Product"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
