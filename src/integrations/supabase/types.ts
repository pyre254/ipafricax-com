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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json
        }
        Relationships: []
      }
      escrow_milestones: {
        Row: {
          amount: number
          completed_at: string | null
          created_at: string
          description: string | null
          id: string
          order_index: number
          status: string
          title: string
          transaction_id: string
        }
        Insert: {
          amount: number
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          order_index?: number
          status?: string
          title: string
          transaction_id: string
        }
        Update: {
          amount?: number
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          order_index?: number
          status?: string
          title?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "escrow_milestones_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "escrow_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      escrow_transactions: {
        Row: {
          amount: number
          buyer_id: string
          created_at: string
          currency: string
          deal_type: string
          funded_at: string | null
          id: string
          license_terms: Json | null
          listing_id: string | null
          released_at: string | null
          seller_id: string
          status: Database["public"]["Enums"]["escrow_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          buyer_id: string
          created_at?: string
          currency?: string
          deal_type: string
          funded_at?: string | null
          id?: string
          license_terms?: Json | null
          listing_id?: string | null
          released_at?: string | null
          seller_id: string
          status?: Database["public"]["Enums"]["escrow_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          buyer_id?: string
          created_at?: string
          currency?: string
          deal_type?: string
          funded_at?: string | null
          id?: string
          license_terms?: Json | null
          listing_id?: string | null
          released_at?: string | null
          seller_id?: string
          status?: Database["public"]["Enums"]["escrow_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "escrow_transactions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "ip_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      ip_listings: {
        Row: {
          abstract: string
          ai_embedding: Json | null
          ai_readiness_score: number | null
          ai_summary: string | null
          ai_valuation_high: number | null
          ai_valuation_low: number | null
          asking_price: number | null
          cover_image_url: string | null
          created_at: string
          currency: string
          description: string | null
          documents: Json
          id: string
          industry_tags: string[]
          ip_type: Database["public"]["Enums"]["ip_type"]
          jurisdictions: string[]
          license_types: string[]
          owner_id: string
          registration_authority: string | null
          registration_number: string | null
          status: Database["public"]["Enums"]["listing_status"]
          title: string
          updated_at: string
          verification_notes: string | null
          verification_status: Database["public"]["Enums"]["verification_status"]
          verified_at: string | null
          verified_by: string | null
          view_count: number
        }
        Insert: {
          abstract: string
          ai_embedding?: Json | null
          ai_readiness_score?: number | null
          ai_summary?: string | null
          ai_valuation_high?: number | null
          ai_valuation_low?: number | null
          asking_price?: number | null
          cover_image_url?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          documents?: Json
          id?: string
          industry_tags?: string[]
          ip_type: Database["public"]["Enums"]["ip_type"]
          jurisdictions?: string[]
          license_types?: string[]
          owner_id: string
          registration_authority?: string | null
          registration_number?: string | null
          status?: Database["public"]["Enums"]["listing_status"]
          title: string
          updated_at?: string
          verification_notes?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
          verified_at?: string | null
          verified_by?: string | null
          view_count?: number
        }
        Update: {
          abstract?: string
          ai_embedding?: Json | null
          ai_readiness_score?: number | null
          ai_summary?: string | null
          ai_valuation_high?: number | null
          ai_valuation_low?: number | null
          asking_price?: number | null
          cover_image_url?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          documents?: Json
          id?: string
          industry_tags?: string[]
          ip_type?: Database["public"]["Enums"]["ip_type"]
          jurisdictions?: string[]
          license_types?: string[]
          owner_id?: string
          registration_authority?: string | null
          registration_number?: string | null
          status?: Database["public"]["Enums"]["listing_status"]
          title?: string
          updated_at?: string
          verification_notes?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
          verified_at?: string | null
          verified_by?: string | null
          view_count?: number
        }
        Relationships: []
      }
      kyc_submissions: {
        Row: {
          full_legal_name: string
          id: string
          id_document_number: string
          id_document_type: string
          id_document_url: string | null
          org_certificate_url: string | null
          org_registration_number: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          reviewer_notes: string | null
          selfie_url: string | null
          status: Database["public"]["Enums"]["kyc_status"]
          submitted_at: string
          user_id: string
        }
        Insert: {
          full_legal_name: string
          id?: string
          id_document_number: string
          id_document_type: string
          id_document_url?: string | null
          org_certificate_url?: string | null
          org_registration_number?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_notes?: string | null
          selfie_url?: string | null
          status?: Database["public"]["Enums"]["kyc_status"]
          submitted_at?: string
          user_id: string
        }
        Update: {
          full_legal_name?: string
          id?: string
          id_document_number?: string
          id_document_type?: string
          id_document_url?: string | null
          org_certificate_url?: string | null
          org_registration_number?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_notes?: string | null
          selfie_url?: string | null
          status?: Database["public"]["Enums"]["kyc_status"]
          submitted_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          country: string | null
          created_at: string
          full_name: string | null
          id: string
          kyc_status: Database["public"]["Enums"]["kyc_status"]
          org_type: string | null
          org_verified: boolean
          organization: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          country?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          org_type?: string | null
          org_verified?: boolean
          organization?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          country?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          org_type?: string | null
          org_verified?: boolean
          organization?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "rights_holder" | "buyer" | "verifier"
      escrow_status:
        | "initiated"
        | "funded"
        | "in_progress"
        | "milestone_completed"
        | "released"
        | "disputed"
        | "refunded"
        | "cancelled"
      ip_type:
        | "patent"
        | "trademark"
        | "industrial_design"
        | "copyright"
        | "utility_model"
        | "trade_secret"
      kyc_status: "not_started" | "pending" | "approved" | "rejected"
      listing_status:
        | "draft"
        | "pending_review"
        | "active"
        | "sold"
        | "withdrawn"
      verification_status: "unverified" | "pending" | "verified" | "rejected"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "rights_holder", "buyer", "verifier"],
      escrow_status: [
        "initiated",
        "funded",
        "in_progress",
        "milestone_completed",
        "released",
        "disputed",
        "refunded",
        "cancelled",
      ],
      ip_type: [
        "patent",
        "trademark",
        "industrial_design",
        "copyright",
        "utility_model",
        "trade_secret",
      ],
      kyc_status: ["not_started", "pending", "approved", "rejected"],
      listing_status: [
        "draft",
        "pending_review",
        "active",
        "sold",
        "withdrawn",
      ],
      verification_status: ["unverified", "pending", "verified", "rejected"],
    },
  },
} as const
