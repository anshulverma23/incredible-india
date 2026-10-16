export interface BlogPost {
  _id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  author: string;
  date: string;
  image: string;
  tags: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface BlogListResponse {
  success: boolean;
  count: number;
  blogs: BlogPost[];
}

export interface BlogSingleResponse {
  success: boolean;
  blog: BlogPost;
}