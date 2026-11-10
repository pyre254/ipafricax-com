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
      certificate_checks: {
        Row: {
          created_at: string
          extracted: Json
          file_path: string
          id: string
          listing_id: string
          match_score: number | null
          mismatches: Json
          owner_id: string
          review_status: string
          reviewed_at: string | null
          reviewer_id: string | null
          reviewer_notes: string | null
        }
        Insert: {
          created_at?: string
          extracted?: Json
          file_path: string
          id?: string
          listing_id: string
          match_score?: number | null
          mismatches?: Json
          owner_id: string
          review_status?: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_notes?: string | null
        }
        Update: {
          created_at?: string
          extracted?: Json
          file_path?: string
          id?: string
          listing_id?: string
          match_score?: number | null
          mismatches?: Json
          owner_id?: string
          review_status?: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "certificate_checks_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "ip_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      certificate_proofs: {
        Row: {
          created_at: string
          created_by: string
          file_name: string | null
          id: string
          listing_id: string
          ots_calendar: string | null
          ots_proof: string | null
          prev_record_hash: string | null
          record_hash: string
          sha256: string
        }
        Insert: {
          created_at?: string
          created_by: string
          file_name?: string | null
          id?: string
          listing_id: string
          ots_calendar?: string | null
          ots_proof?: string | null
          prev_record_hash?: string | null
          record_hash: string
          sha256: string
        }
        Update: {
          created_at?: string
          created_by?: string
          file_name?: string | null
          id?: string
          listing_id?: string
          ots_calendar?: string | null
          ots_proof?: string | null
          prev_record_hash?: string | null
          record_hash?: string
          sha256?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificate_proofs_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "ip_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_submissions: {
        Row: {
          admin_notes: string | null
          created_at: string
          email: string
          handled_by: string | null
          id: string
          message: string
          name: string
          phone: string | null
          status: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          email: string
          handled_by?: string | null
          id?: string
          message: string
          name: string
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          email?: string
          handled_by?: string | null
          id?: string
          message?: string
          name?: string
          phone?: string | null
          status?: string
          updated_at?: string
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
          cert_expiry_date: string | null
          cert_grant_date: string | null
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
          cert_expiry_date?: string | null
          cert_grant_date?: string | null
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
          cert_expiry_date?: string | null
          cert_grant_date?: string | null
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
      ip_verification_audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json
          id: string
          verification_request_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          verification_request_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          verification_request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ip_verification_audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ip_verification_audit_logs_verification_request_id_fkey"
            columns: ["verification_request_id"]
            isOneToOne: false
            referencedRelation: "ip_verification_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      ip_verification_documents: {
        Row: {
          created_at: string
          document_type: string
          extracted_fields: Json | null
          file_size: number
          id: string
          mime_type: string
          original_filename: string
          sha256_hash: string
          storage_path: string
          uploaded_by: string
          verification_request_id: string
        }
        Insert: {
          created_at?: string
          document_type: string
          extracted_fields?: Json | null
          file_size: number
          id?: string
          mime_type: string
          original_filename: string
          sha256_hash: string
          storage_path: string
          uploaded_by: string
          verification_request_id: string
        }
        Update: {
          created_at?: string
          document_type?: string
          extracted_fields?: Json | null
          file_size?: number
          id?: string
          mime_type?: string
          original_filename?: string
          sha256_hash?: string
          storage_path?: string
          uploaded_by?: string
          verification_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ip_verification_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ip_verification_documents_verification_request_id_fkey"
            columns: ["verification_request_id"]
            isOneToOne: false
            referencedRelation: "ip_verification_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      ip_verification_evidence: {
        Row: {
          created_at: string
          evidence_hash: string
          id: string
          journal_id: string | null
          page_number: number | null
          source_title: string
          source_type: string
          source_url: string
          supporting_extract: string
          verification_result_id: string
        }
        Insert: {
          created_at?: string
          evidence_hash: string
          id?: string
          journal_id?: string | null
          page_number?: number | null
          source_title: string
          source_type: string
          source_url: string
          supporting_extract: string
          verification_result_id: string
        }
        Update: {
          created_at?: string
          evidence_hash?: string
          id?: string
          journal_id?: string | null
          page_number?: number | null
          source_title?: string
          source_type?: string
          source_url?: string
          supporting_extract?: string
          verification_result_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ip_verification_evidence_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "kipi_journals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ip_verification_evidence_verification_result_id_fkey"
            columns: ["verification_result_id"]
            isOneToOne: false
            referencedRelation: "ip_verification_results"
            referencedColumns: ["id"]
          },
        ]
      }
      ip_verification_requests: {
        Row: {
          administrator_decision: string | null
          administrator_notes: string | null
          applicant_name: string
          application_date: string | null
          certificate_number: string | null
          claimed_registration_date: string | null
          completed_at: string | null
          created_at: string
          declared_authorized: boolean
          id: string
          ip_category: string
          ip_title: string | null
          lease_until: string | null
          listing_id: string | null
          normalized_registration_number: string
          official_confirmation_url: string | null
          processing_error: string | null
          registration_number: string
          submission_status: string
          updated_at: string
          user_id: string
          verification_reference: string
          verification_status: string
        }
        Insert: {
          administrator_decision?: string | null
          administrator_notes?: string | null
          applicant_name: string
          application_date?: string | null
          certificate_number?: string | null
          claimed_registration_date?: string | null
          completed_at?: string | null
          created_at?: string
          declared_authorized: boolean
          id?: string
          ip_category: string
          ip_title?: string | null
          lease_until?: string | null
          listing_id?: string | null
          normalized_registration_number: string
          official_confirmation_url?: string | null
          processing_error?: string | null
          registration_number: string
          submission_status?: string
          updated_at?: string
          user_id: string
          verification_reference?: string
          verification_status?: string
        }
        Update: {
          administrator_decision?: string | null
          administrator_notes?: string | null
          applicant_name?: string
          application_date?: string | null
          certificate_number?: string | null
          claimed_registration_date?: string | null
          completed_at?: string | null
          created_at?: string
          declared_authorized?: boolean
          id?: string
          ip_category?: string
          ip_title?: string | null
          lease_until?: string | null
          listing_id?: string | null
          normalized_registration_number?: string
          official_confirmation_url?: string | null
          processing_error?: string | null
          registration_number?: string
          submission_status?: string
          updated_at?: string
          user_id?: string
          verification_reference?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ip_verification_requests_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "ip_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ip_verification_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ip_verification_results: {
        Row: {
          ai_model: string | null
          certificate_authenticity: string
          certificate_consistency: string
          coverage_snapshot: Json
          evidence_completeness: number
          evidence_summary: string
          field_comparison: Json
          generated_at: string
          id: string
          matched_record_id: string | null
          record_match: boolean
          registration_status: string
          report_path: string | null
          result_status: string
          risk_indicators: Json
          verification_request_id: string
        }
        Insert: {
          ai_model?: string | null
          certificate_authenticity?: string
          certificate_consistency?: string
          coverage_snapshot?: Json
          evidence_completeness?: number
          evidence_summary: string
          field_comparison?: Json
          generated_at?: string
          id?: string
          matched_record_id?: string | null
          record_match?: boolean
          registration_status?: string
          report_path?: string | null
          result_status: string
          risk_indicators?: Json
          verification_request_id: string
        }
        Update: {
          ai_model?: string | null
          certificate_authenticity?: string
          certificate_consistency?: string
          coverage_snapshot?: Json
          evidence_completeness?: number
          evidence_summary?: string
          field_comparison?: Json
          generated_at?: string
          id?: string
          matched_record_id?: string | null
          record_match?: boolean
          registration_status?: string
          report_path?: string | null
          result_status?: string
          risk_indicators?: Json
          verification_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ip_verification_results_matched_record_id_fkey"
            columns: ["matched_record_id"]
            isOneToOne: false
            referencedRelation: "kipi_ip_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ip_verification_results_verification_request_id_fkey"
            columns: ["verification_request_id"]
            isOneToOne: false
            referencedRelation: "ip_verification_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      ip_verification_reviews: {
        Row: {
          administrator_id: string
          confirmation_url: string | null
          id: string
          new_status: string
          previous_status: string
          review_decision: string
          review_notes: string
          reviewed_at: string
          verification_request_id: string
        }
        Insert: {
          administrator_id: string
          confirmation_url?: string | null
          id?: string
          new_status: string
          previous_status: string
          review_decision: string
          review_notes: string
          reviewed_at?: string
          verification_request_id: string
        }
        Update: {
          administrator_id?: string
          confirmation_url?: string | null
          id?: string
          new_status?: string
          previous_status?: string
          review_decision?: string
          review_notes?: string
          reviewed_at?: string
          verification_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ip_verification_reviews_administrator_id_fkey"
            columns: ["administrator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ip_verification_reviews_verification_request_id_fkey"
            columns: ["verification_request_id"]
            isOneToOne: false
            referencedRelation: "ip_verification_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      ip_verification_settings: {
        Row: {
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          setting_key: string
          setting_value: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ip_verification_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      kipi_ip_records: {
        Row: {
          applicant_name: string | null
          classification_code: string | null
          created_at: string
          expiry_date: string | null
          extracted_text: string
          extraction_confidence: number
          filing_date: string | null
          id: string
          ip_category: string
          ip_title: string | null
          journal_id: string
          normalized_registration_number: string
          original_registration_number: string
          proprietor_name: string | null
          publication_date: string | null
          record_hash: string
          recorded_status: string
          registration_date: string | null
          source_page_number: number
        }
        Insert: {
          applicant_name?: string | null
          classification_code?: string | null
          created_at?: string
          expiry_date?: string | null
          extracted_text: string
          extraction_confidence?: number
          filing_date?: string | null
          id?: string
          ip_category: string
          ip_title?: string | null
          journal_id: string
          normalized_registration_number: string
          original_registration_number: string
          proprietor_name?: string | null
          publication_date?: string | null
          record_hash: string
          recorded_status?: string
          registration_date?: string | null
          source_page_number: number
        }
        Update: {
          applicant_name?: string | null
          classification_code?: string | null
          created_at?: string
          expiry_date?: string | null
          extracted_text?: string
          extraction_confidence?: number
          filing_date?: string | null
          id?: string
          ip_category?: string
          ip_title?: string | null
          journal_id?: string
          normalized_registration_number?: string
          original_registration_number?: string
          proprietor_name?: string | null
          publication_date?: string | null
          record_hash?: string
          recorded_status?: string
          registration_date?: string | null
          source_page_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "kipi_ip_records_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "kipi_journals"
            referencedColumns: ["id"]
          },
        ]
      }
      kipi_journal_pages: {
        Row: {
          created_at: string
          evidence_hash: string
          extracted_text: string
          extraction_method: string
          id: string
          journal_id: string
          page_number: number
          requires_ocr: boolean
        }
        Insert: {
          created_at?: string
          evidence_hash: string
          extracted_text: string
          extraction_method?: string
          id?: string
          journal_id: string
          page_number: number
          requires_ocr?: boolean
        }
        Update: {
          created_at?: string
          evidence_hash?: string
          extracted_text?: string
          extraction_method?: string
          id?: string
          journal_id?: string
          page_number?: number
          requires_ocr?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "kipi_journal_pages_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "kipi_journals"
            referencedColumns: ["id"]
          },
        ]
      }
      kipi_journals: {
        Row: {
          archive_format: string
          archive_member: string | null
          created_at: string
          discovery_url: string
          file_hash: string | null
          id: string
          indexed_records_count: number
          journal_title: string
          last_synced_at: string
          lease_until: string | null
          parent_journal_id: string | null
          processed_pages: number
          processing_error: string | null
          processing_status: string
          publication_month: number | null
          publication_year: number
          source_url: string
          storage_path: string | null
          total_pages: number | null
        }
        Insert: {
          archive_format: string
          archive_member?: string | null
          created_at?: string
          discovery_url: string
          file_hash?: string | null
          id?: string
          indexed_records_count?: number
          journal_title: string
          last_synced_at?: string
          lease_until?: string | null
          parent_journal_id?: string | null
          processed_pages?: number
          processing_error?: string | null
          processing_status?: string
          publication_month?: number | null
          publication_year: number
          source_url: string
          storage_path?: string | null
          total_pages?: number | null
        }
        Update: {
          archive_format?: string
          archive_member?: string | null
          created_at?: string
          discovery_url?: string
          file_hash?: string | null
          id?: string
          indexed_records_count?: number
          journal_title?: string
          last_synced_at?: string
          lease_until?: string | null
          parent_journal_id?: string | null
          processed_pages?: number
          processing_error?: string | null
          processing_status?: string
          publication_month?: number | null
          publication_year?: number
          source_url?: string
          storage_path?: string | null
          total_pages?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "kipi_journals_parent_journal_id_fkey"
            columns: ["parent_journal_id"]
            isOneToOne: false
            referencedRelation: "kipi_journals"
            referencedColumns: ["id"]
          },
        ]
      }
      kipi_sync_runs: {
        Row: {
          completed_at: string | null
          coverage_note: string | null
          discovered_count: number
          error_message: string | null
          id: string
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          coverage_note?: string | null
          discovered_count?: number
          error_message?: string | null
          id?: string
          started_at?: string
          status: string
        }
        Update: {
          completed_at?: string | null
          coverage_note?: string | null
          discovered_count?: number
          error_message?: string | null
          id?: string
          started_at?: string
          status?: string
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
      listing_payments: {
        Row: {
          amount: number
          applied_at: string | null
          check_lease_until: string | null
          checkout_request_id: string | null
          confirmation_method: string | null
          confirmed_at: string | null
          created_at: string
          currency: string
          environment: string
          id: string
          idempotency_key: string
          merchant_request_id: string | null
          new_expiry: string | null
          owner_id: string
          phone_number: string
          provider_message: string | null
          provider_result_code: string | null
          status: string
          subscription_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          applied_at?: string | null
          check_lease_until?: string | null
          checkout_request_id?: string | null
          confirmation_method?: string | null
          confirmed_at?: string | null
          created_at?: string
          currency?: string
          environment?: string
          id?: string
          idempotency_key: string
          merchant_request_id?: string | null
          new_expiry?: string | null
          owner_id: string
          phone_number: string
          provider_message?: string | null
          provider_result_code?: string | null
          status?: string
          subscription_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          applied_at?: string | null
          check_lease_until?: string | null
          checkout_request_id?: string | null
          confirmation_method?: string | null
          confirmed_at?: string | null
          created_at?: string
          currency?: string
          environment?: string
          id?: string
          idempotency_key?: string
          merchant_request_id?: string | null
          new_expiry?: string | null
          owner_id?: string
          phone_number?: string
          provider_message?: string | null
          provider_result_code?: string | null
          status?: string
          subscription_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_payments_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "listing_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_subscriptions: {
        Row: {
          admin_hidden: boolean
          admin_notes: string | null
          expires_at: string
          id: string
          introductory_expires_at: string
          ip_listing_id: string | null
          owner_id: string
          period_type: string
          published_at: string
          service_listing_id: string | null
          updated_at: string
        }
        Insert: {
          admin_hidden?: boolean
          admin_notes?: string | null
          expires_at: string
          id?: string
          introductory_expires_at: string
          ip_listing_id?: string | null
          owner_id: string
          period_type?: string
          published_at: string
          service_listing_id?: string | null
          updated_at?: string
        }
        Update: {
          admin_hidden?: boolean
          admin_notes?: string | null
          expires_at?: string
          id?: string
          introductory_expires_at?: string
          ip_listing_id?: string | null
          owner_id?: string
          period_type?: string
          published_at?: string
          service_listing_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_subscriptions_ip_listing_id_fkey"
            columns: ["ip_listing_id"]
            isOneToOne: true
            referencedRelation: "ip_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_subscriptions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_subscriptions_service_listing_id_fkey"
            columns: ["service_listing_id"]
            isOneToOne: true
            referencedRelation: "service_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_visibility_events: {
        Row: {
          created_at: string
          event_key: string
          id: string
          kind: string
          owner_id: string
          subscription_id: string
        }
        Insert: {
          created_at?: string
          event_key: string
          id?: string
          kind: string
          owner_id: string
          subscription_id: string
        }
        Update: {
          created_at?: string
          event_key?: string
          id?: string
          kind?: string
          owner_id?: string
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_visibility_events_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "listing_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_maintenance_state: {
        Row: {
          last_completed_at: string | null
          lease_until: string | null
          singleton: boolean
        }
        Insert: {
          last_completed_at?: string | null
          lease_until?: string | null
          singleton?: boolean
        }
        Update: {
          last_completed_at?: string | null
          lease_until?: string | null
          singleton?: boolean
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          dedupe_key: string | null
          id: string
          kind: string
          listing_id: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          dedupe_key?: string | null
          id?: string
          kind: string
          listing_id?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          dedupe_key?: string | null
          id?: string
          kind?: string
          listing_id?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "ip_listings"
            referencedColumns: ["id"]
          },
        ]
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
      service_listings: {
        Row: {
          contact_email: string | null
          created_at: string
          description: string
          id: string
          organization: string | null
          owner_id: string
          profession: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          contact_email?: string | null
          created_at?: string
          description: string
          id?: string
          organization?: string | null
          owner_id: string
          profession: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          contact_email?: string | null
          created_at?: string
          description?: string
          id?: string
          organization?: string | null
          owner_id?: string
          profession?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_listings_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      super_admin: {
        Row: {
          created_at: string
          singleton: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          singleton?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          singleton?: boolean
          user_id?: string
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
      apply_verified_listing_payment: {
        Args: {
          p_code: string
          p_confirmed_at: string
          p_id: string
          p_message: string
        }
        Returns: string
      }
      claim_ip_verification: { Args: { p_id: string }; Returns: boolean }
      claim_kipi_journal: { Args: { p_id: string }; Returns: boolean }
      claim_kipi_journal_internal: { Args: { p_id: string }; Returns: boolean }
      claim_listing_payment_check: { Args: { p_id: string }; Returns: boolean }
      claim_marketplace_maintenance: { Args: never; Returns: boolean }
      decide_kyc: {
        Args: { p_id: string; p_notes: string; p_status: string }
        Returns: undefined
      }
      decide_listing: {
        Args: { p_id: string; p_notes: string; p_status: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      listing_has_visibility: {
        Args: { p_ip?: string; p_service?: string }
        Returns: boolean
      }
      manage_account_role: {
        Args: {
          p_enabled: boolean
          p_role: Database["public"]["Enums"]["app_role"]
          p_user_id: string
        }
        Returns: undefined
      }
      manage_listing_visibility: {
        Args: { p_hidden: boolean; p_id: string; p_notes: string }
        Returns: undefined
      }
      process_listing_visibility_notifications: { Args: never; Returns: number }
      queue_expiry_reminders: { Args: never; Returns: number }
      release_marketplace_maintenance: { Args: never; Returns: undefined }
      review_ip_verification: {
        Args: {
          p_confirmation_url?: string
          p_decision: string
          p_id: string
          p_notes: string
        }
        Returns: undefined
      }
      review_service_listing: {
        Args: { p_approve: boolean; p_id: string; p_notes: string }
        Returns: undefined
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
