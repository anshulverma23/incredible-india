import { api } from "@/lib/axios";

import type {
  BlogListResponse,
  BlogSingleResponse,
  BlogPost,
} from "@/features/blog/types";

export const blogApi = {
  // ==========================================
  // GET ALL BLOGS
  // GET /api/blogs
  // ==========================================
  list: () =>
    api.get<BlogListResponse>("/blogs"),

  // ==========================================
  // GET BLOG BY SLUG
  // GET /api/blogs/:slug
  // ==========================================
  getBySlug: (slug: string) =>
    api.get<BlogSingleResponse>(`/blogs/${slug}`),

  // ==========================================
  // CREATE BLOG
  // POST /api/blogs
  // ==========================================
  create: (data: FormData) =>
    api.post<{
      success: boolean;
      message: string;
      blog: BlogPost;
    }>("/blogs", data),

  // ==========================================
  // UPDATE BLOG
  // PUT /api/blogs/:id
  // ==========================================
  update: (id: string, data: FormData) =>
    api.put<{
      success: boolean;
      message: string;
      blog: BlogPost;
    }>(`/blogs/${id}`, data),

  // ==========================================
  // DELETE BLOG
  // DELETE /api/blogs/:id
  // ==========================================
  deleteById: (id: string) =>
    api.delete<{
      success: boolean;
      message: string;
    }>(`/blogs/${id}`),
};