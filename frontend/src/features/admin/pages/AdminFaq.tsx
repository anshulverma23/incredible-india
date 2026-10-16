import { useEffect, useState } from "react"
import { Plus, Edit, Trash2, X } from "lucide-react"

import {
  AdminTable,
  type AdminColumn,
} from "@/features/admin/components/data-table"

import { Badge } from "@/components/ui/badge"
import { Select } from "@/components/ui/select"
import { useToast } from "@/hooks/useToast"
import { ApiError } from "@/lib/axios"
import { faqApi } from "@/features/faq/api/faq.api"

export interface FAQ {
  _id: string
  question: string
  answer: string
  category: string
  isActive: boolean
  order: number
  createdAt?: string
  updatedAt?: string
}

const CATEGORY_OPTIONS = [
  "General",
  "Travel",
  "Booking",
  "Visa",
  "Tours",
  "Payment",
  "Safety",
]

export default function AdminFaqPage() {
  const { toast } = useToast()

  const [faqs, setFaqs] = useState<FAQ[]>([])
  const [loading, setLoading] = useState(true)

  const [showModal, setShowModal] = useState(false)
  const [editingFaq, setEditingFaq] = useState<FAQ | null>(null)

  const [formData, setFormData] = useState({
    question: "",
    answer: "",
    category: "General",
    isActive: true,
    order: 0,
  })

  const fetchFAQs = async () => {
    try {
      setLoading(true)

      const res = await faqApi.list()

      setFaqs((res.faqs as FAQ[]) || [])
    } catch (err) {
      console.error("Admin FAQs error:", err)

      toast(
        err instanceof ApiError
          ? err.message
          : "Could not load FAQs",
        "error"
      )

      setFaqs([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchFAQs()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openCreateModal = () => {
    setEditingFaq(null)

    setFormData({
      question: "",
      answer: "",
      category: "General",
      isActive: true,
      order: faqs.length + 1,
    })

    setShowModal(true)
  }

  const openEditModal = (faq: FAQ) => {
    setEditingFaq(faq)

    setFormData({
      question: faq.question,
      answer: faq.answer,
      category: faq.category || "General",
      isActive: faq.isActive,
      order: faq.order || 0,
    })

    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingFaq(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.question.trim()) {
      toast("Question is required", "error")
      return
    }

    if (!formData.answer.trim()) {
      toast("Answer is required", "error")
      return
    }

    try {
      if (editingFaq) {
        await faqApi.update(editingFaq._id, formData)

        toast("FAQ updated successfully")
      } else {
        await faqApi.create(formData)

        toast("FAQ created successfully")
      }

      closeModal()
      await fetchFAQs()
    } catch (err) {
      console.error("FAQ save error:", err)

      toast(
        err instanceof ApiError
          ? err.message
          : "Could not save FAQ",
        "error"
      )
    }
  }

  const handleDelete = async (faq: FAQ) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete this FAQ?\n\n"${faq.question}"`
    )

    if (!confirmed) {
      return
    }

    try {
      await faqApi.remove(faq._id)

      toast("FAQ deleted successfully")

      await fetchFAQs()
    } catch (err) {
      console.error("Delete FAQ error:", err)

      toast(
        err instanceof ApiError
          ? err.message
          : "Could not delete FAQ",
        "error"
      )
    }
  }

  const columns: AdminColumn<FAQ>[] = [
    {
      key: "question",
      label: "Question",
      render: (faq) => (
        <div className="max-w-md">
          <p className="font-medium text-foreground">
            {faq.question}
          </p>

          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {faq.answer}
          </p>
        </div>
      ),
    },

    {
      key: "category",
      label: "Category",
      render: (faq) => (
        <Badge variant="outline">
          {faq.category || "General"}
        </Badge>
      ),
    },

    {
      key: "order",
      label: "Order",
      render: (faq) => faq.order ?? 0,
    },

    {
      key: "isActive",
      label: "Status",
      render: (faq) => (
        <Badge
          variant={faq.isActive ? "default" : "outline"}
        >
          {faq.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },

    {
      key: "actions",
      label: "Actions",
      render: (faq) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openEditModal(faq)}
            className="inline-flex items-center justify-center rounded-md p-2 hover:bg-muted transition"
            title="Edit FAQ"
          >
            <Edit className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => handleDelete(faq)}
            className="inline-flex items-center justify-center rounded-md p-2 hover:bg-muted transition"
            title="Delete FAQ"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-2xl font-bold text-foreground">
          Manage FAQs
        </h1>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition"
        >
          <Plus className="h-4 w-4" />
          Add FAQ
        </button>
      </div>

      {/* FAQ Table */}
      <AdminTable
        columns={columns}
        rows={faqs}
        loading={loading}
      />

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-2xl rounded-xl bg-background shadow-xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="font-serif text-xl font-bold">
                {editingFaq ? "Edit FAQ" : "Add FAQ"}
              </h2>

              <button
                type="button"
                onClick={closeModal}
                className="rounded-md p-2 hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form
              onSubmit={handleSubmit}
              className="space-y-5 p-6"
            >
              {/* Question */}
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Question
                </label>

                <input
                  type="text"
                  value={formData.question}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      question: e.target.value,
                    }))
                  }
                  placeholder="Enter FAQ question"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {/* Answer */}
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Answer
                </label>

                <textarea
                  value={formData.answer}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      answer: e.target.value,
                    }))
                  }
                  placeholder="Enter FAQ answer"
                  rows={6}
                  className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {/* Category + Order */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Category
                  </label>

                  <Select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        category: e.target.value,
                      }))
                    }
                  >
                    {CATEGORY_OPTIONS.map((category) => (
                      <option
                        key={category}
                        value={category}
                      >
                        {category}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Display Order
                  </label>

                  <input
                    type="number"
                    min="0"
                    value={formData.order}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        order: Number(e.target.value),
                      }))
                    }
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>

              {/* Active */}
              <div className="flex items-center gap-3">
                <input
                  id="faq-active"
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      isActive: e.target.checked,
                    }))
                  }
                  className="h-4 w-4"
                />

                <label
                  htmlFor="faq-active"
                  className="text-sm font-medium"
                >
                  Active FAQ
                </label>
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-3 border-t pt-5">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted transition"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition"
                >
                  {editingFaq ? "Update FAQ" : "Create FAQ"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
