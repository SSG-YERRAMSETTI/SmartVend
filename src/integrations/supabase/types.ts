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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      alert_rules: {
        Row: {
          created_at: string
          created_by: string | null
          enabled: boolean
          id: string
          name: string
          rule_type: string
          threshold_duration_minutes: number | null
          threshold_value: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          name: string
          rule_type: string
          threshold_duration_minutes?: number | null
          threshold_value?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          name?: string
          rule_type?: string
          threshold_duration_minutes?: number | null
          threshold_value?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_rule_id: string | null
          created_at: string
          id: string
          machine_id: string | null
          message: string
          metadata: Json | null
          resolved_at: string | null
          severity: string
          status: string
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_rule_id?: string | null
          created_at?: string
          id?: string
          machine_id?: string | null
          message: string
          metadata?: Json | null
          resolved_at?: string | null
          severity?: string
          status?: string
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_rule_id?: string | null
          created_at?: string
          id?: string
          machine_id?: string | null
          message?: string
          metadata?: Json | null
          resolved_at?: string | null
          severity?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_alert_rule_id_fkey"
            columns: ["alert_rule_id"]
            isOneToOne: false
            referencedRelation: "alert_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          scopes: string[]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          scopes?: string[]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          scopes?: string[]
        }
        Relationships: []
      }
      api_rate_limits: {
        Row: {
          api_key_id: string
          created_at: string
          endpoint: string
          id: string
          request_count: number
          window_start: string
        }
        Insert: {
          api_key_id: string
          created_at?: string
          endpoint: string
          id?: string
          request_count?: number
          window_start?: string
        }
        Update: {
          api_key_id?: string
          created_at?: string
          endpoint?: string
          id?: string
          request_count?: number
          window_start?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      cash_collections: {
        Row: {
          collected_at: string
          counted_cash: number
          created_at: string
          created_by: string | null
          expected_cash: number
          id: string
          machine_id: string
          notes: string | null
          photo_urls: string[] | null
          route_stop_id: string | null
          variance: number | null
        }
        Insert: {
          collected_at?: string
          counted_cash: number
          created_at?: string
          created_by?: string | null
          expected_cash: number
          id?: string
          machine_id: string
          notes?: string | null
          photo_urls?: string[] | null
          route_stop_id?: string | null
          variance?: number | null
        }
        Update: {
          collected_at?: string
          counted_cash?: number
          created_at?: string
          created_by?: string | null
          expected_cash?: number
          id?: string
          machine_id?: string
          notes?: string | null
          photo_urls?: string[] | null
          route_stop_id?: string | null
          variance?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_collections_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_collections_route_stop_id_fkey"
            columns: ["route_stop_id"]
            isOneToOne: false
            referencedRelation: "route_stops"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_statements: {
        Row: {
          adjustments: number | null
          commission_amount: number
          created_at: string
          created_by: string | null
          gross_sales: number
          id: string
          location_id: string
          period_end: string
          period_start: string
          status: Database["public"]["Enums"]["commission_status"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          adjustments?: number | null
          commission_amount: number
          created_at?: string
          created_by?: string | null
          gross_sales: number
          id?: string
          location_id: string
          period_end: string
          period_start: string
          status?: Database["public"]["Enums"]["commission_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          adjustments?: number | null
          commission_amount?: number
          created_at?: string
          created_by?: string | null
          gross_sales?: number
          id?: string
          location_id?: string
          period_end?: string
          period_start?: string
          status?: Database["public"]["Enums"]["commission_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commission_statements_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_batches: {
        Row: {
          batch_number: string
          created_at: string
          created_by: string | null
          expiry_date: string | null
          id: string
          location_id: string
          location_type: string
          product_id: string
          quantity: number
          received_at: string
          unit_cost: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          batch_number: string
          created_at?: string
          created_by?: string | null
          expiry_date?: string | null
          id?: string
          location_id: string
          location_type: string
          product_id: string
          quantity?: number
          received_at?: string
          unit_cost: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          batch_number?: string
          created_at?: string
          created_by?: string | null
          expiry_date?: string | null
          id?: string
          location_id?: string
          location_type?: string
          product_id?: string
          quantity?: number
          received_at?: string
          unit_cost?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_ledger: {
        Row: {
          created_at: string
          created_by: string | null
          entity_id: string
          entity_type: Database["public"]["Enums"]["entity_type"]
          id: string
          product_id: string
          qty_change: number
          reason: string
          ref_doc: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          entity_id: string
          entity_type: Database["public"]["Enums"]["entity_type"]
          id?: string
          product_id: string
          qty_change: number
          reason: string
          ref_doc?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          entity_id?: string
          entity_type?: Database["public"]["Enums"]["entity_type"]
          id?: string
          product_id?: string
          qty_change?: number
          reason?: string
          ref_doc?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_ledger_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_transfers: {
        Row: {
          batch_id: string | null
          created_at: string
          created_by: string | null
          from_location_id: string
          from_location_type: string
          id: string
          notes: string | null
          product_id: string
          quantity: number
          status: string
          to_location_id: string
          to_location_type: string
          transferred_at: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          created_by?: string | null
          from_location_id: string
          from_location_type: string
          id?: string
          notes?: string | null
          product_id: string
          quantity: number
          status?: string
          to_location_id: string
          to_location_type: string
          transferred_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          created_by?: string | null
          from_location_id?: string
          from_location_type?: string
          id?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          status?: string
          to_location_id?: string
          to_location_type?: string
          transferred_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transfers_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "inventory_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address: string
          commission_type: Database["public"]["Enums"]["commission_type"]
          commission_value: number
          contact_name: string | null
          created_at: string
          created_by: string | null
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          payout_frequency: Database["public"]["Enums"]["payout_frequency"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address: string
          commission_type?: Database["public"]["Enums"]["commission_type"]
          commission_value: number
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          payout_frequency?: Database["public"]["Enums"]["payout_frequency"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address?: string
          commission_type?: Database["public"]["Enums"]["commission_type"]
          commission_value?: number
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          payout_frequency?: Database["public"]["Enums"]["payout_frequency"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      machines: {
        Row: {
          asset_tag: string
          cashless_enabled: boolean | null
          created_at: string
          created_by: string | null
          id: string
          location_id: string | null
          model: string
          planogram_id: string | null
          serial: string
          status: Database["public"]["Enums"]["machine_status"]
          telemetry_device_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          asset_tag: string
          cashless_enabled?: boolean | null
          created_at?: string
          created_by?: string | null
          id?: string
          location_id?: string | null
          model: string
          planogram_id?: string | null
          serial: string
          status?: Database["public"]["Enums"]["machine_status"]
          telemetry_device_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          asset_tag?: string
          cashless_enabled?: boolean | null
          created_at?: string
          created_by?: string | null
          id?: string
          location_id?: string | null
          model?: string
          planogram_id?: string | null
          serial?: string
          status?: Database["public"]["Enums"]["machine_status"]
          telemetry_device_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "machines_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      price_list_items: {
        Row: {
          created_at: string
          id: string
          price_list_id: string
          product_id: string
          sell_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          price_list_id: string
          product_id: string
          sell_price: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          price_list_id?: string
          product_id?: string
          sell_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_list_items_price_list_id_fkey"
            columns: ["price_list_id"]
            isOneToOne: false
            referencedRelation: "price_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_list_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      price_lists: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      products: {
        Row: {
          active: boolean | null
          barcode: string | null
          category: string
          cost_price: number
          created_at: string
          created_by: string | null
          id: string
          name: string
          reorder_point: number | null
          sell_price: number
          sku: string
          tax_rate: number | null
          unit_size: string | null
          updated_at: string
          updated_by: string | null
          warehouse_stock: number | null
        }
        Insert: {
          active?: boolean | null
          barcode?: string | null
          category: string
          cost_price: number
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          reorder_point?: number | null
          sell_price: number
          sku: string
          tax_rate?: number | null
          unit_size?: string | null
          updated_at?: string
          updated_by?: string | null
          warehouse_stock?: number | null
        }
        Update: {
          active?: boolean | null
          barcode?: string | null
          category?: string
          cost_price?: number
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          reorder_point?: number | null
          sell_price?: number
          sku?: string
          tax_rate?: number | null
          unit_size?: string | null
          updated_at?: string
          updated_by?: string | null
          warehouse_stock?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      refill_orders: {
        Row: {
          created_at: string
          created_by: string | null
          fulfilled: boolean | null
          id: string
          picked_qty: number | null
          product_id: string
          required_qty: number
          route_stop_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          fulfilled?: boolean | null
          id?: string
          picked_qty?: number | null
          product_id: string
          required_qty: number
          route_stop_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          fulfilled?: boolean | null
          id?: string
          picked_qty?: number | null
          product_id?: string
          required_qty?: number
          route_stop_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "refill_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refill_orders_route_stop_id_fkey"
            columns: ["route_stop_id"]
            isOneToOne: false
            referencedRelation: "route_stops"
            referencedColumns: ["id"]
          },
        ]
      }
      route_stops: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          machine_id: string
          planned_date: string
          route_id: string
          sequence: number
          status: Database["public"]["Enums"]["route_stop_status"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          machine_id: string
          planned_date: string
          route_id: string
          sequence: number
          status?: Database["public"]["Enums"]["route_stop_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          machine_id?: string
          planned_date?: string
          route_id?: string
          sequence?: number
          status?: Database["public"]["Enums"]["route_stop_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "route_stops_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_stops_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      routes: {
        Row: {
          created_at: string
          created_by: string | null
          frequency: Database["public"]["Enums"]["route_frequency"]
          id: string
          name: string
          start_warehouse_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          frequency?: Database["public"]["Enums"]["route_frequency"]
          id?: string
          name: string
          start_warehouse_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          frequency?: Database["public"]["Enums"]["route_frequency"]
          id?: string
          name?: string
          start_warehouse_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "routes_start_warehouse_id_fkey"
            columns: ["start_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          batch_id: string | null
          created_at: string
          id: string
          machine_id: string
          occurred_at: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          product_id: string
          qty: number
          unit_price: number
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          id?: string
          machine_id: string
          occurred_at?: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          product_id: string
          qty?: number
          unit_price: number
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          id?: string
          machine_id?: string
          occurred_at?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          product_id?: string
          qty?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      slots: {
        Row: {
          capacity: number
          created_at: string
          created_by: string | null
          current_qty: number
          id: string
          machine_id: string
          par_level: number
          position: string
          product_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          capacity: number
          created_at?: string
          created_by?: string | null
          current_qty?: number
          id?: string
          machine_id: string
          par_level?: number
          position: string
          product_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          capacity?: number
          created_at?: string
          created_by?: string | null
          current_qty?: number
          id?: string
          machine_id?: string
          par_level?: number
          position?: string
          product_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "slots_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slots_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      telemetry_events: {
        Row: {
          created_at: string
          event_type: Database["public"]["Enums"]["telemetry_event_type"]
          id: string
          machine_id: string
          occurred_at: string
          payload_json: Json | null
        }
        Insert: {
          created_at?: string
          event_type: Database["public"]["Enums"]["telemetry_event_type"]
          id?: string
          machine_id: string
          occurred_at?: string
          payload_json?: Json | null
        }
        Update: {
          created_at?: string
          event_type?: Database["public"]["Enums"]["telemetry_event_type"]
          id?: string
          machine_id?: string
          occurred_at?: string
          payload_json?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "telemetry_events_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          assigned_user_id: string | null
          created_at: string
          created_by: string | null
          description: string
          id: string
          machine_id: string | null
          priority: Database["public"]["Enums"]["ticket_priority"]
          status: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assigned_user_id?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          machine_id?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          status?: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assigned_user_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          machine_id?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          status?: Database["public"]["Enums"]["ticket_status"]
          subject?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tickets_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          assigned_driver_id: string | null
          capacity: number | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          plate: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assigned_driver_id?: string | null
          capacity?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          plate: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assigned_driver_id?: string | null
          capacity?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          plate?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      warehouses: {
        Row: {
          address: string
          contact: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address: string
          contact?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address?: string
          contact?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      webhooks: {
        Row: {
          created_at: string
          created_by: string | null
          enabled: boolean
          events: string[]
          id: string
          name: string
          secret: string
          updated_at: string
          updated_by: string | null
          url: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          events?: string[]
          id?: string
          name: string
          secret: string
          updated_at?: string
          updated_by?: string | null
          url: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          events?: string[]
          id?: string
          name?: string
          secret?: string
          updated_at?: string
          updated_by?: string | null
          url?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_roles: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "dispatcher"
        | "driver"
        | "accountant"
        | "location_partner"
      commission_status: "draft" | "pending" | "paid"
      commission_type: "percentage" | "fixed"
      entity_type: "warehouse" | "vehicle" | "machine"
      machine_status: "active" | "inactive" | "maintenance"
      payment_method: "cash" | "cashless"
      payout_frequency: "weekly" | "biweekly" | "monthly"
      route_frequency: "daily" | "weekly" | "custom"
      route_stop_status: "pending" | "in_progress" | "completed" | "skipped"
      telemetry_event_type: "sale" | "door_open" | "alert" | "error" | "restock"
      ticket_priority: "low" | "medium" | "high" | "urgent"
      ticket_status: "open" | "in_progress" | "resolved" | "closed"
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
      app_role: [
        "admin",
        "dispatcher",
        "driver",
        "accountant",
        "location_partner",
      ],
      commission_status: ["draft", "pending", "paid"],
      commission_type: ["percentage", "fixed"],
      entity_type: ["warehouse", "vehicle", "machine"],
      machine_status: ["active", "inactive", "maintenance"],
      payment_method: ["cash", "cashless"],
      payout_frequency: ["weekly", "biweekly", "monthly"],
      route_frequency: ["daily", "weekly", "custom"],
      route_stop_status: ["pending", "in_progress", "completed", "skipped"],
      telemetry_event_type: ["sale", "door_open", "alert", "error", "restock"],
      ticket_priority: ["low", "medium", "high", "urgent"],
      ticket_status: ["open", "in_progress", "resolved", "closed"],
    },
  },
} as const
