"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "react-hot-toast";
import * as XLSX from "xlsx";

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

export default function VendorProductsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [form, setForm] = useState({
    name: "",
    description: "",
    price: 0,
    comparePrice: 0,
    currency: "USD",
    inventory: 0,
    sku: "",
    category: "",
    status: "active" as Product["status"],
    images: [] as File[],
    existingImages: [] as string[],
  });

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
  }, [session, status]);

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
    const { name, value, files } = e.target as any;

    if (files) {
      const resizedFiles = await Promise.all(Array.from(files).map(f => resizeImage(f)));
      setForm(prev => ({ ...prev, [name]: resizedFiles }));
    } else {
      setForm(prev => ({ ...prev, [name]: value }));
    }
  };

  const openAddModal = () => {
    setEditingProduct(null);
    setForm({
      name: "",
      description: "",
      price: 0,
      comparePrice: 0,
      currency: "USD",
      inventory: 0,
      sku: "",
      category: "",
      status: "active",
      images: [],
      existingImages: [],
    });
    setShowModal(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setForm({
      name: product.name,
      description: product.description || "",
      price: product.price,
      comparePrice: product.comparePrice || 0,
      currency: product.currency || "USD",
      inventory: product.inventory,
      sku: product.sku,
      category: product.category,
      status: product.status,
      images: [],
      existingImages: product.images || [],
    });
    setShowModal(true);
  };

  const handleSave = async () => {
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

    form.images.forEach(img => formData.append("images", img));
    form.existingImages.forEach(url => formData.append("existingImages", url));

    try {
      const url = editingProduct ? `/api/vendor/products/${editingProduct.id}` : "/api/vendor/products";
      const method = editingProduct ? "PUT" : "POST";
      const res = await fetch(url, { method, body: formData });

      if (!res.ok) throw new Error("Failed to save product");

      toast.success("Product saved successfully!");
      fetchProducts();
      setShowModal(false);
    } catch (err) {
      console.error(err);
      toast.error("Error saving product");
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
    const jsonData = XLSX.utils.sheet_to_json(sheet);

    try {
      const res = await fetch("/api/vendor/products/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(jsonData),
      });
      if (!res.ok) throw new Error("Bulk upload failed");
      toast.success("Products uploaded successfully!");
      fetchProducts();
    } catch (err) {
      console.error(err);
      toast.error("Bulk upload failed");
    }
  };

  if (status === "loading" || loading) {
    return <div className="container mx-auto px-4 py-8">Loading...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-3xl font-bold">Your Products</h1>
        <div className="flex gap-2">
          <Button onClick={openAddModal}>Add Product</Button>
          <Input type="file" accept=".csv, .xlsx" onChange={handleBulkUpload} />
        </div>
      </div>

      <div className="rounded-md border">
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
            {products.length > 0 ? products.map(product => (
              <TableRow key={product.id}>
                <TableCell>{product.id}</TableCell>
                <TableCell>{product.name}</TableCell>
                <TableCell>{new Intl.NumberFormat('en-US', { style: 'currency', currency: product.currency }).format(product.price)}</TableCell>
                <TableCell>{product.inventory}</TableCell>
                <TableCell>{product.category}</TableCell>
                <TableCell>
                  <Badge variant={product.status === "active" ? "default" : "outline"}>
                    {product.status.replace("_", " ").toUpperCase()}
                  </Badge>
                </TableCell>
                <TableCell className="text-right flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" onClick={() => openEditModal(product)}>Edit</Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(product.id)}>Delete</Button>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  No products found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Edit Product" : "Add Product"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <Input name="name" value={form.name} onChange={handleFormChange} placeholder="Product Name" />
            <Input name="description" value={form.description} onChange={handleFormChange} placeholder="Description" />
            <Input type="number" name="price" value={form.price} onChange={handleFormChange} placeholder="Price" />
            <Input type="number" name="comparePrice" value={form.comparePrice} onChange={handleFormChange} placeholder="Compare Price" />
            <Select name="currency" value={form.currency} onValueChange={v => setForm(prev => ({ ...prev, currency: v }))}>
              <SelectTrigger><SelectValue placeholder="Currency" /></SelectTrigger>
              <SelectContent>
                {["USD","EUR","GBP","NGN"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="number" name="inventory" value={form.inventory} onChange={handleFormChange} placeholder="Inventory" />
            <Input name="sku" value={form.sku} onChange={handleFormChange} placeholder="SKU" />
            <Input name="category" value={form.category} onChange={handleFormChange} placeholder="Category" />
            <Select name="status" value={form.status} onValueChange={v => setForm(prev => ({ ...prev, status: v as Product["status"] }))}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="low_stock">Low Stock</SelectItem>
              </SelectContent>
            </Select>

            <input type="file" name="images" multiple onChange={handleFormChange} accept="image/*" />
            {form.existingImages.length > 0 && (
              <div className="flex gap-2 flex-wrap mt-2">
                {form.existingImages.map((img, i) => (
                  <div key={i} className="relative">
                    <img src={img} alt="Product" className="w-20 h-20 object-cover rounded border" />
                    <button
                      type="button"
                      className="absolute top-0 right-0 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center"
                      onClick={() => setForm(prev => ({ ...prev, existingImages: prev.existingImages.filter((_, idx) => idx !== i) }))}
                    >×</button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button onClick={handleSave}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
