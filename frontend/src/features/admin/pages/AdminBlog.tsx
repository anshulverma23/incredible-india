import { useEffect, useState } from "react";
import { Edit, Plus, Trash2, X } from "lucide-react";

import {
  AdminTable,
  type AdminColumn,
} from "@/features/admin/components/data-table";
import { blogApi } from "@/features/blog/api/blog.api";
import type { BlogPost } from "@/features/blog/types";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { useToast } from "@/hooks/useToast";
import { ApiError } from "@/lib/axios";

type BlogForm = {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  author: string;
  date: string;
  image: string;
  tags: string;
};

const getEmptyForm = (): BlogForm => ({
  slug: "",
  title: "",
  excerpt: "",
  content: "",
  author: "Team India Travel",
  date: new Date().toISOString().split("T")[0],
  image: "",
  tags: "",
});

export default function AdminBlog() {
  const { toast } = useToast();

  const [blogs, setBlogs] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState<BlogForm>(getEmptyForm());
  const [saving, setSaving] = useState(false);

  // --------------------------------
  // FETCH BLOGS
  // --------------------------------

  const fetchBlogs = async () => {
    try {
      setLoading(true);

      const response = await blogApi.list();

      setBlogs(response.blogs || []);
    } catch (err) {
      console.error("Fetch blogs error:", err);

      toast(
        err instanceof ApiError ? err.message : "Could not load blogs",
        "error"
      );

      setBlogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchBlogs();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --------------------------------
  // INPUT CHANGE
  // --------------------------------

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  // --------------------------------
  // ADD BLOG
  // --------------------------------

  const handleAdd = () => {
    setEditingId(null);
    setForm(getEmptyForm());
    setModalOpen(true);
  };

  // --------------------------------
  // EDIT BLOG
  // --------------------------------

  const handleEdit = (blog: BlogPost) => {
    setEditingId(blog._id);

    setForm({
      slug: blog.slug || "",
      title: blog.title || "",
      excerpt: blog.excerpt || "",

      /*
       * Database mein content array hai:
       *
       * [
       *   "First paragraph",
       *   "Second paragraph"
       * ]
       *
       * Popup textarea mein isko:
       *
       * First paragraph
       *
       * Second paragraph
       *
       * ke form mein dikhayenge.
       */
      content: Array.isArray(blog.content)
        ? blog.content
            .map((paragraph) => String(paragraph).trim())
            .filter(Boolean)
            .join("\n\n")
        : typeof blog.content === "string"
          ? blog.content
          : "",

      author: blog.author || "",

      date: blog.date
        ? blog.date.split("T")[0]
        : new Date().toISOString().split("T")[0],

      image: blog.image || "",

      tags: Array.isArray(blog.tags)
        ? blog.tags.join(", ")
        : typeof blog.tags === "string"
          ? blog.tags
          : "",
    });

    setModalOpen(true);
  };

  // --------------------------------
  // CLOSE MODAL
  // --------------------------------

  const closeModal = () => {
    if (saving) return;

    setModalOpen(false);
    setEditingId(null);
    setForm(getEmptyForm());
  };

  // --------------------------------
  // BUILD FORM DATA
  // --------------------------------

  const buildFormData = () => {
    const data = new FormData();

    data.append("slug", form.slug.trim());
    data.append("title", form.title.trim());
    data.append("excerpt", form.excerpt.trim());

    /*
     * CONTENT
     *
     * User textarea:
     *
     * Paragraph 1
     *
     * Paragraph 2
     *
     * Paragraph 3
     *
     * Database:
     *
     * [
     *   "Paragraph 1",
     *   "Paragraph 2",
     *   "Paragraph 3"
     * ]
     */

    const content = form.content
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);

    data.append("content", JSON.stringify(content));

    // AUTHOR
    data.append("author", form.author.trim());

    // DATE
    data.append("date", form.date);

    // IMAGE
    data.append("image", form.image.trim());

    /*
     * TAGS
     *
     * India, Travel, Rajasthan
     *
     * becomes:
     *
     * ["India", "Travel", "Rajasthan"]
     */

    const tags = form.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    data.append("tags", JSON.stringify(tags));

    return data;
  };

  // --------------------------------
  // CREATE / UPDATE
  // --------------------------------

  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    if (!form.title.trim()) {
      toast("Blog title is required", "error");
      return;
    }

    if (!form.slug.trim()) {
      toast("Blog slug is required", "error");
      return;
    }

    if (!form.excerpt.trim()) {
      toast("Blog excerpt is required", "error");
      return;
    }

    if (!form.content.trim()) {
      toast("Blog content is required", "error");
      return;
    }

    try {
      setSaving(true);

      const data = buildFormData();

      if (editingId) {
        await blogApi.update(editingId, data);

        toast("Blog updated successfully");
      } else {
        await blogApi.create(data);

        toast("Blog created successfully");
      }

      closeModal();

      await fetchBlogs();
    } catch (err) {
      console.error("Save blog error:", err);

      toast(
        err instanceof ApiError
          ? err.message
          : editingId
            ? "Could not update blog"
            : "Could not create blog",
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  // --------------------------------
  // DELETE
  // --------------------------------

  const handleDelete = async (blog: BlogPost) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${blog.title}"?`
    );

    if (!confirmed) return;

    try {
      await blogApi.deleteById(blog._id);

      toast("Blog deleted successfully");

      setBlogs((previous) =>
        previous.filter((item) => item._id !== blog._id)
      );

      if (editingId === blog._id) {
        closeModal();
      }
    } catch (err) {
      console.error("Delete blog error:", err);

      toast(
        err instanceof ApiError ? err.message : "Could not delete blog",
        "error"
      );
    }
  };

  // --------------------------------
  // TABLE COLUMNS
  // --------------------------------

  const columns: AdminColumn<BlogPost>[] = [
    {
      key: "title",
      label: "Blog",

      render: (blog) => (
        <div className="flex items-center gap-3 min-w-[240px]">
          {blog.image ? (
            <img
              src={blog.image}
              alt={blog.title}
              className="h-12 w-16 rounded-md object-cover border"
            />
          ) : (
            <div className="h-12 w-16 rounded-md bg-muted flex items-center justify-center text-xs text-muted-foreground">
              No image
            </div>
          )}

          <div className="min-w-0">
            <p className="font-medium text-foreground truncate max-w-[220px]">
              {blog.title || "—"}
            </p>

            <p className="text-xs text-muted-foreground truncate max-w-[220px]">
              {blog.slug || "—"}
            </p>
          </div>
        </div>
      ),
    },

    {
      key: "author",
      label: "Author",
      render: (blog) => blog.author || "—",
    },

    {
      key: "date",
      label: "Date",

      render: (blog) => {
        if (!blog.date) return "—";

        return new Date(blog.date).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
      },
    },

    {
      key: "tags",
      label: "Tags",

      render: (blog) => (
        <div className="flex flex-wrap gap-1 max-w-[220px]">
          {blog.tags?.length ? (
            blog.tags.slice(0, 3).map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="text-xs"
              >
                {tag}
              </Badge>
            ))
          ) : (
            "—"
          )}

          {blog.tags && blog.tags.length > 3 && (
            <Badge
              variant="outline"
              className="text-xs"
            >
              +{blog.tags.length - 3}
            </Badge>
          )}
        </div>
      ),
    },

    {
      key: "actions",
      label: "Actions",

      render: (blog) => (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleEdit(blog)}
          >
            <Edit className="h-4 w-4 mr-1" />
            Edit
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleDelete(blog)}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Delete
          </Button>
        </div>
      ),
    },
  ];

  // --------------------------------
  // UI
  // --------------------------------

  return (
    <div>
      {/* HEADER */}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl font-bold text-foreground">
            Manage Blogs
          </h1>

          <p className="text-sm text-muted-foreground mt-1">
            Create, edit and manage travel blogs.
          </p>
        </div>

        <Button
          type="button"
          onClick={handleAdd}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Blog
        </Button>
      </div>

      {/* TABLE */}

      <Card className="p-0 overflow-hidden">
        <AdminTable
          columns={columns}
          rows={blogs}
          loading={loading}
        />
      </Card>

      {/* MODAL */}

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              closeModal();
            }
          }}
        >
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl bg-background shadow-xl">

            {/* MODAL HEADER */}

            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background px-6 py-4">
              <div>
                <h2 className="text-xl font-semibold">
                  {editingId ? "Edit Blog" : "Add Blog"}
                </h2>

                <p className="text-sm text-muted-foreground mt-1">
                  {editingId
                    ? "Update the blog information."
                    : "Create a new travel blog."}
                </p>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={closeModal}
                disabled={saving}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* FORM */}

            <form
              onSubmit={handleSubmit}
              className="p-6 space-y-5"
            >
              {/* TITLE */}

              <div className="space-y-2">
                <label
                  htmlFor="title"
                  className="text-sm font-medium"
                >
                  Title
                </label>

                <input
                  id="title"
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  placeholder="Enter blog title"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  disabled={saving}
                />
              </div>

              {/* SLUG */}

              <div className="space-y-2">
                <label
                  htmlFor="slug"
                  className="text-sm font-medium"
                >
                  Slug
                </label>

                <input
                  id="slug"
                  name="slug"
                  value={form.slug}
                  onChange={handleChange}
                  placeholder="example-travel-blog"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  disabled={saving}
                />
              </div>

              {/* EXCERPT */}

              <div className="space-y-2">
                <label
                  htmlFor="excerpt"
                  className="text-sm font-medium"
                >
                  Excerpt
                </label>

                <textarea
                  id="excerpt"
                  name="excerpt"
                  value={form.excerpt}
                  onChange={handleChange}
                  placeholder="Short description of the blog..."
                  rows={3}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none resize-none focus:ring-2 focus:ring-primary/20"
                  disabled={saving}
                />
              </div>

              {/* CONTENT */}

              <div className="space-y-2">
                <label
                  htmlFor="content"
                  className="text-sm font-medium"
                >
                  Content
                </label>

                <textarea
                  id="content"
                  name="content"
                  value={form.content}
                  onChange={handleChange}
                  placeholder={`Write your blog content here...

First paragraph...

Second paragraph...

Third paragraph...`}
                  rows={12}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none resize-y focus:ring-2 focus:ring-primary/20"
                  disabled={saving}
                />

                <p className="text-xs text-muted-foreground">
                  Har paragraph ke beech ek empty line rakhein.
                </p>
              </div>

              {/* AUTHOR + DATE */}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                <div className="space-y-2">
                  <label
                    htmlFor="author"
                    className="text-sm font-medium"
                  >
                    Author
                  </label>

                  <input
                    id="author"
                    name="author"
                    value={form.author}
                    onChange={handleChange}
                    placeholder="Author name"
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                    disabled={saving}
                  />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="date"
                    className="text-sm font-medium"
                  >
                    Date
                  </label>

                  <input
                    id="date"
                    name="date"
                    type="date"
                    value={form.date}
                    onChange={handleChange}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                    disabled={saving}
                  />
                </div>

              </div>

              {/* IMAGE */}

              <div className="space-y-2">
                <label
                  htmlFor="image"
                  className="text-sm font-medium"
                >
                  Image URL
                </label>

                <input
                  id="image"
                  name="image"
                  value={form.image}
                  onChange={handleChange}
                  placeholder="https://..."
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  disabled={saving}
                />

                {form.image && (
                  <img
                    src={form.image}
                    alt="Preview"
                    className="mt-2 h-32 w-52 rounded-md object-cover border"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                )}
              </div>

              {/* TAGS */}

              <div className="space-y-2">
                <label
                  htmlFor="tags"
                  className="text-sm font-medium"
                >
                  Tags
                </label>

                <input
                  id="tags"
                  name="tags"
                  value={form.tags}
                  onChange={handleChange}
                  placeholder="India, Travel, Rajasthan"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  disabled={saving}
                />

                <p className="text-xs text-muted-foreground">
                  Multiple tags ko comma se separate karein.
                </p>
              </div>

              {/* FOOTER */}

              <div className="flex justify-end gap-3 border-t pt-5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editingId
                      ? "Update Blog"
                      : "Create Blog"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}