import { api, type QueryParams } from "@/lib/axios";
import type { PaginatedResponse } from "@/types";
import type { Hotel, OwnerContact, Room } from "@/features/hotels/types";

export const hotelApi = {
  list: (params: QueryParams = {}) =>
    api.get<PaginatedResponse<Hotel>>("/hotels", params),
  get: (id: string) =>
    api.get<{ hotel: Hotel; rooms: Room[] }>(`/hotels/${id}`),
  checkAvailability: (hotelId: string, params: QueryParams) =>
    api.get<{ available: boolean; availableRooms: number }>(
      `/hotels/${hotelId}/availability`,
      params,
    ),
  /** Admin only: private contact of the hotel owner (used to confirm booking requests). */
  ownerContact: (id: string) => api.get<{ ownerContact: OwnerContact }>(`/hotels/${id}/owner-contact`),
  create: (formData: FormData) => api.post("/hotels", formData),
  update: (id: string, formData: FormData) =>
    api.put(`/hotels/${id}`, formData),
  remove: (id: string) => api.delete(`/hotels/${id}`),
  addRoom: (hotelId: string, formData: FormData) =>
    api.post(`/hotels/${hotelId}/rooms`, formData),
  updateRoom: (hotelId: string, roomId: string, formData: FormData) =>
    api.put(`/hotels/${hotelId}/rooms/${roomId}`, formData),
  deleteRoom: (hotelId: string, roomId: string) =>
    api.delete(`/hotels/${hotelId}/rooms/${roomId}`),
};
