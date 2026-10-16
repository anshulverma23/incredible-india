import { useEffect, useState } from "react"
import { AdminTable, type AdminColumn } from "@/features/admin/components/data-table"
import { AdminFormModal, type AdminField } from "@/features/admin/components/resource-modal"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/useToast"
import { formatDate } from "@/lib/utils"
import { couponApi } from "@/features/payments/api/coupon.api"
import { ApiError } from "@/lib/axios"
import type { Coupon } from "@/features/payments/types"

const fields: AdminField[] = [
  { name: "code", label: "Coupon Code", type: "text", required: true, hint: "e.g. WELCOME10" },
  { name: "discountType", label: "Discount Type", type: "select", required: true, options: [{ label: "Percentage", value: "percentage" }, { label: "Flat Amount", value: "flat" }] },
  { name: "discountValue", label: "Discount Value", type: "number", required: true },
  { name: "applicableOn", label: "Applicable On", type: "select", options: [{ label: "All", value: "all" }, { label: "Hotels Only", value: "hotel" }, { label: "Packages Only", value: "package" }] },
  { name: "minPurchaseAmount", label: "Min Purchase Amount (₹)", type: "number" },
  { name: "maxDiscountAmount", label: "Max Discount Cap (₹)", type: "number" },
  { name: "usageLimit", label: "Total Usage Limit", type: "number", hint: "Across all customers" },
  { name: "perUserLimit", label: "Per-User Limit", type: "number", hint: "How many times one customer can use it (default 1)" },
  { name: "expiryDate", label: "Expiry Date", type: "date", required: true },
]

export default function AdminCouponsPage() {
  const { toast } = useToast()
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Coupon | null>(null)

  const fetchCoupons = () =>
    couponApi.adminList().then((res) => setCoupons(res.coupons)).finally(() => setLoading(false))

  const load = () => {
    setLoading(true)
    fetchCoupons()
  }

  useEffect(() => {
    fetchCoupons()
  }, [])

  const handleSubmit = async (values: Record<string, unknown>) => {
    const body = {
      code: String(values.code || "").toUpperCase(),
      discountType: values.discountType,
      discountValue: Number(values.discountValue),
      applicableOn: values.applicableOn || "all",
      minPurchaseAmount: Number(values.minPurchaseAmount) || 0,
      maxDiscountAmount: values.maxDiscountAmount ? Number(values.maxDiscountAmount) : undefined,
      usageLimit: Number(values.usageLimit) || 100,
      perUserLimit: Number(values.perUserLimit) || 1,
      expiryDate: values.expiryDate,
    }
    if (editing) {
      await couponApi.update(editing._id, body)
      toast("Coupon updated")
    } else {
      await couponApi.create(body)
      toast("Coupon created")
    }
    load()
  }

  const handleDelete = async (c: Coupon) => {
    if (!confirm(`Delete coupon "${c.code}"?`)) return
    try {
      await couponApi.remove(c._id)
      toast("Coupon deleted")
      load()
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Could not delete coupon", "error")
    }
  }

  const columns: AdminColumn<Coupon>[] = [
    { key: "code", label: "Code" },
    { key: "discount", label: "Discount", render: (c) => (c.discountType === "percentage" ? `${c.discountValue}%` : `₹${c.discountValue}`) },
    { key: "applicableOn", label: "Applies To", render: (c) => <Badge variant="outline">{c.applicableOn}</Badge> },
    { key: "usage", label: "Used", render: (c) => `${c.usedCount} / ${c.usageLimit} (max ${c.perUserLimit ?? 1}/user)` },
    { key: "expiryDate", label: "Expires", render: (c) => formatDate(c.expiryDate) },
    { key: "isActive", label: "Status", render: (c) => <Badge variant={c.isActive ? "default" : "outline"} className={c.isActive ? "bg-primary/10 text-primary" : ""}>{c.isActive ? "Active" : "Inactive"}</Badge> },
  ]

  const initialValues = editing
    ? {
        code: editing.code,
        discountType: editing.discountType,
        discountValue: editing.discountValue,
        applicableOn: editing.applicableOn,
        minPurchaseAmount: editing.minPurchaseAmount,
        maxDiscountAmount: editing.maxDiscountAmount,
        usageLimit: editing.usageLimit,
        perUserLimit: editing.perUserLimit ?? 1,
        expiryDate: editing.expiryDate?.split("T")[0],
      }
    : { discountType: "percentage", applicableOn: "all" }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-2xl font-bold text-foreground">Manage Coupons</h1>
        <Button onClick={() => { setEditing(null); setModalOpen(true) }} className="bg-primary text-primary-foreground hover:bg-primary/90">+ Add Coupon</Button>
      </div>

      <AdminTable
        columns={columns}
        rows={coupons}
        loading={loading}
        onEdit={(c) => { setEditing(c); setModalOpen(true) }}
        onDelete={handleDelete}
      />

      <AdminFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editing ? "Edit Coupon" : "Add Coupon"}
        fields={fields}
        initialValues={initialValues}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
