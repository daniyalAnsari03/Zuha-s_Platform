export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type OrderStatus =
  | "Order Placed"
  | "Order Confirmed"
  | "Processing"
  | "Shipped"
  | "Delivered"
  | "Cancelled";

export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  /** Desktop slide image: shown on tablet and desktop. */
  image_url: string | null;
  /** Optional mobile slide image: shown below the tablet breakpoint. */
  mobile_image_url: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type SubCategory = {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type Product = {
  id: string;
  category_id: string | null;
  sub_category_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  discount_price: number | null;
  /** Free-text, comma separated (e.g. 'S, M, L'). */
  sizes: string | null;
  /** Free-text, comma separated (e.g. 'Black, Red'). Added by migration 004. */
  color: string | null;
  stock_quantity: number;
  low_stock_threshold: number;
  images: string[];
  /**
   * Optional colour tag per gallery image, index-aligned with `images`
   * (migration 017); '' means "no tag". Optional in the type so the admin save
   * and the storefront still type-check before that migration is applied.
   */
  image_colors?: string[] | null;
  is_active: boolean;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
};

export type Customer = {
  id: string;
  user_id: string | null;
  email: string;
  full_name: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  is_guest: boolean;
  created_at: string;
  updated_at: string;
};

export type Order = {
  id: string;
  order_number: string;
  customer_id: string | null;
  user_id: string | null;
  guest_token: string | null;
  /** Secret required by the confirmation page. Added by migration 012. */
  confirmation_token: string | null;
  status: OrderStatus;
  customer_email: string;
  customer_name: string | null;
  customer_phone: string | null;
  shipping_address: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_postal_code: string | null;
  shipping_country: string | null;
  shipping_method: string | null;
  subtotal: number;
  shipping_fee: number;
  discount: number;
  total: number;
  payment_method: string | null;
  payment_reference: string | null;
  is_paid: boolean;
  notes: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  product_slug: string | null;
  variant: string | null;
  /** The colour chosen at checkout, free text. Added by migration 009. */
  color: string | null;
  unit_price: number;
  quantity: number;
  line_total: number;
  created_at: string;
};

export type Announcement = {
  id: string;
  title: string;
  body: string | null;
  link_url: string | null;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TeamMember = {
  id: string;
  name: string;
  role: string;
  bio: string | null;
  image_url: string | null;
  email: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Setting = {
  key: string;
  value: Json;
  description: string | null;
  updated_at: string;
};

/**
 * A message sent from the /contact form (migration 013). Private correspondence:
 * it is written by the `sendContactMessage` server action and read only by the
 * dashboard's Messages screen, both through the service role.
 */
export type ContactMessage = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

/**
 * Public store contact details (migration 010). Single row, id = 1, readable
 * by everyone and written only by the dashboard through the service role.
 * Every field is an empty string when it has not been filled in yet.
 */
export type StoreDetails = {
  id: number;
  store_name: string;
  contact_email: string;
  phone: string;
  address: string;
  instagram_url: string;
  facebook_url: string;
  tiktok_url: string;
  whatsapp_url: string;
  /** `1 USD = X PKR` (migration 015). NULL hides the USD option. */
  usd_rate: number | null;
  /** `1 EUR = X PKR` (migration 016). NULL hides the EUR option. */
  eur_rate: number | null;
  /** `1 GBP = X PKR` (migration 016). NULL hides the GBP option. */
  gbp_rate: number | null;
  /** `1 AED = X PKR` (migration 016). NULL hides the AED option. */
  aed_rate: number | null;
  /** `1 CAD = X PKR` (migration 016). NULL hides the CAD option. */
  cad_rate: number | null;
  updated_at: string;
};

/**
 * A public store policy page (migration 014): Privacy Policy, Refund Policy,
 * Terms of Service and Shipping Policy. Keyed by slug, publicly readable, and
 * written only by the dashboard's Settings screen through the service role.
 */
export type StorePolicy = {
  slug: string;
  title: string;
  content: string;
  updated_at: string;
};

type Tables = {
  /**
   * Every table entry needs a `Relationships` array, otherwise the whole schema
   * fails the `GenericSchema` check and every query resolves its rows to
   * `never`. FK shapes are filled in on demand as joins get introduced.
   */
  categories: {
    Row: Category;
    Insert: Omit<Category, "id" | "created_at" | "updated_at"> &
      Partial<Pick<Category, "id" | "created_at" | "updated_at">>;
    Update: Partial<Omit<Category, "id" | "created_at" | "updated_at">>;
    Relationships: [];
  };
  sub_categories: {
    Row: SubCategory;
    Insert: Omit<SubCategory, "id" | "created_at" | "updated_at"> &
      Partial<Pick<SubCategory, "id" | "created_at" | "updated_at">>;
    Update: Partial<Omit<SubCategory, "id" | "created_at" | "updated_at">>;
    Relationships: [];
  };
  products: {
    Row: Product;
    Insert: Omit<Product, "id" | "created_at" | "updated_at"> &
      Partial<Pick<Product, "id" | "created_at" | "updated_at">>;
    Update: Partial<Omit<Product, "id" | "created_at" | "updated_at">>;
    Relationships: [];
  };
  customers: {
    Row: Customer;
    Insert: Omit<Customer, "id" | "created_at" | "updated_at"> &
      Partial<Pick<Customer, "id" | "created_at" | "updated_at">>;
    Update: Partial<Omit<Customer, "id" | "created_at" | "updated_at">>;
    Relationships: [];
  };
  orders: {
    Row: Order;
    Insert: Omit<Order, "id" | "created_at" | "updated_at" | "status"> &
      Partial<
        Pick<Order, "id" | "created_at" | "updated_at" | "status"> & {
          status: OrderStatus;
        }
      >;
    Update: Partial<Omit<Order, "id" | "created_at" | "updated_at">>;
    Relationships: [];
  };
  order_items: {
    Row: OrderItem;
    Insert: Omit<OrderItem, "id" | "created_at"> &
      Partial<Pick<OrderItem, "id" | "created_at">>;
    Update: Partial<Omit<OrderItem, "id" | "created_at">>;
    Relationships: [];
  };
  announcements: {
    Row: Announcement;
    Insert: Omit<Announcement, "id" | "created_at" | "updated_at"> &
      Partial<Pick<Announcement, "id" | "created_at" | "updated_at">>;
    Update: Partial<Omit<Announcement, "id" | "created_at" | "updated_at">>;
    Relationships: [];
  };
  team_members: {
    Row: TeamMember;
    Insert: Omit<TeamMember, "id" | "created_at" | "updated_at"> &
      Partial<Pick<TeamMember, "id" | "created_at" | "updated_at">>;
    Update: Partial<Omit<TeamMember, "id" | "created_at" | "updated_at">>;
    Relationships: [];
  };
  settings: {
    Row: Setting;
    Insert: Omit<Setting, "updated_at"> & Partial<Pick<Setting, "updated_at">>;
    Update: Partial<Omit<Setting, "key">>;
    Relationships: [];
  };
  store_details: {
    Row: StoreDetails;
    Insert: Omit<StoreDetails, "id" | "updated_at"> &
      Partial<Pick<StoreDetails, "id" | "updated_at">>;
    Update: Partial<Omit<StoreDetails, "id">>;
    Relationships: [];
  };
  contact_messages: {
    Row: ContactMessage;
    Insert: Omit<ContactMessage, "id" | "created_at" | "is_read"> &
      Partial<Pick<ContactMessage, "id" | "created_at" | "is_read">>;
    Update: Partial<Omit<ContactMessage, "id" | "created_at">>;
    Relationships: [];
  };
  store_policies: {
    Row: StorePolicy;
    Insert: Omit<StorePolicy, "updated_at"> &
      Partial<Pick<StorePolicy, "updated_at">>;
    Update: Partial<Omit<StorePolicy, "slug">>;
    Relationships: [];
  };
};

type Enums = {
  order_status: OrderStatus;
};

export type Database = {
  public: {
    /**
     * NOTE: do not intersect this with `{ [_ in never]: never }`. The never
     * index signature makes `Tables["categories"]["Row"]` resolve to
     * `never`, which breaks every typed `supabase.from(...).select(...)`.
     */
    Tables: Tables;
    Views: { [_ in never]: never };
    /**
     * RPCs callable through PostgREST. `generate_order_number` is added by
     * migration 006 and is granted to `service_role` only, which is why
     * `placeOrder` (a server action) is the only thing that calls it.
     */
    Functions: {
      generate_order_number: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
    };
    Enums: Enums & { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
