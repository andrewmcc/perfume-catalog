export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      collection_members: {
        Row: {
          collection_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          collection_id: string
          created_at?: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          collection_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_members_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      item_photos: {
        Row: {
          collection_id: string
          created_at: string
          height: number | null
          id: string
          item_id: string
          position: number
          storage_path: string
          thumb_path: string | null
          width: number | null
        }
        Insert: {
          collection_id: string
          created_at?: string
          height?: number | null
          id?: string
          item_id: string
          position?: number
          storage_path: string
          thumb_path?: string | null
          width?: number | null
        }
        Update: {
          collection_id?: string
          created_at?: string
          height?: number | null
          id?: string
          item_id?: string
          position?: number
          storage_path?: string
          thumb_path?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "item_photos_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_photos_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          batch_code: string | null
          collection_id: string
          created_at: string
          format: string
          id: string
          notes: string | null
          overrides: Json
          perfume_id: string
          purchase_currency: string
          purchase_price: number | null
          purchase_source: string | null
          purchased_on: string | null
          set_id: string | null
          size_ml: number | null
          status: string
          updated_at: string
        }
        Insert: {
          batch_code?: string | null
          collection_id: string
          created_at?: string
          format?: string
          id?: string
          notes?: string | null
          overrides?: Json
          perfume_id: string
          purchase_currency?: string
          purchase_price?: number | null
          purchase_source?: string | null
          purchased_on?: string | null
          set_id?: string | null
          size_ml?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          batch_code?: string | null
          collection_id?: string
          created_at?: string
          format?: string
          id?: string
          notes?: string | null
          overrides?: Json
          perfume_id?: string
          purchase_currency?: string
          purchase_price?: number | null
          purchase_source?: string | null
          purchased_on?: string | null
          set_id?: string | null
          size_ml?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_perfume_id_fkey"
            columns: ["perfume_id"]
            isOneToOne: false
            referencedRelation: "perfumes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "sets"
            referencedColumns: ["id"]
          },
        ]
      }
      perfumes: {
        Row: {
          accords: string[]
          collection_id: string | null
          concentration: string | null
          created_at: string
          discontinued: boolean | null
          family: string | null
          flanker: string | null
          gender_marketing: string | null
          house: string
          house_type: string | null
          id: string
          longevity: string | null
          match_key: string | null
          name: string
          notes_base: string[]
          notes_heart: string[]
          notes_top: string[]
          occasions: string[]
          perfumers: string[]
          reformulated: boolean | null
          release_year: number | null
          seasons: string[]
          sillage: string | null
          sources: Json
          subfamily: string | null
          times_of_day: string[]
          typical_price_per_ml: number | null
        }
        Insert: {
          accords?: string[]
          collection_id?: string | null
          concentration?: string | null
          created_at?: string
          discontinued?: boolean | null
          family?: string | null
          flanker?: string | null
          gender_marketing?: string | null
          house: string
          house_type?: string | null
          id?: string
          longevity?: string | null
          match_key?: string | null
          name: string
          notes_base?: string[]
          notes_heart?: string[]
          notes_top?: string[]
          occasions?: string[]
          perfumers?: string[]
          reformulated?: boolean | null
          release_year?: number | null
          seasons?: string[]
          sillage?: string | null
          sources?: Json
          subfamily?: string | null
          times_of_day?: string[]
          typical_price_per_ml?: number | null
        }
        Update: {
          accords?: string[]
          collection_id?: string | null
          concentration?: string | null
          created_at?: string
          discontinued?: boolean | null
          family?: string | null
          flanker?: string | null
          gender_marketing?: string | null
          house?: string
          house_type?: string | null
          id?: string
          longevity?: string | null
          match_key?: string | null
          name?: string
          notes_base?: string[]
          notes_heart?: string[]
          notes_top?: string[]
          occasions?: string[]
          perfumers?: string[]
          reformulated?: boolean | null
          release_year?: number | null
          seasons?: string[]
          sillage?: string | null
          sources?: Json
          subfamily?: string | null
          times_of_day?: string[]
          typical_price_per_ml?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "perfumes_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      scan_results: {
        Row: {
          collection_id: string
          created_at: string
          created_item_id: string | null
          id: string
          kind: string
          position: number
          read: Json
          scan_id: string
          status: string
        }
        Insert: {
          collection_id: string
          created_at?: string
          created_item_id?: string | null
          id?: string
          kind: string
          position: number
          read: Json
          scan_id: string
          status?: string
        }
        Update: {
          collection_id?: string
          created_at?: string
          created_item_id?: string | null
          id?: string
          kind?: string
          position?: number
          read?: Json
          scan_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "scan_results_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scan_results_created_item_id_fkey"
            columns: ["created_item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scan_results_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]
          },
        ]
      }
      scans: {
        Row: {
          attempts: number
          collection_id: string
          created_at: string
          created_by: string | null
          error: string | null
          extraction: Json | null
          id: string
          mode: string
          model: string | null
          photo_paths: string[]
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          collection_id: string
          created_at?: string
          created_by?: string | null
          error?: string | null
          extraction?: Json | null
          id?: string
          mode: string
          model?: string | null
          photo_paths: string[]
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          collection_id?: string
          created_at?: string
          created_by?: string | null
          error?: string | null
          extraction?: Json | null
          id?: string
          mode?: string
          model?: string | null
          photo_paths?: string[]
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scans_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      sets: {
        Row: {
          collection_id: string
          created_at: string
          house: string | null
          id: string
          name: string | null
          notes: string | null
        }
        Insert: {
          collection_id: string
          created_at?: string
          house?: string | null
          id?: string
          name?: string | null
          notes?: string | null
        }
        Update: {
          collection_id?: string
          created_at?: string
          house?: string | null
          id?: string
          name?: string | null
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sets_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      normalise_name: { Args: { p_text: string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
