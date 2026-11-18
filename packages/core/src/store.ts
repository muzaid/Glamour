/**
 * Row types mirror supabase/migrations/0001_core.sql. `MemoryStore` is the
 * demo/test backend (single Node process, synchronous critical sections give
 * atomic inventory reservation). A Postgres-backed store is ticket F-011.
 */
import type {
  CosmeticCategory, Finish, MotionComposition, OrderStatus, ProductStatus, ProjectStatus, RenderStatus, Role,
  TryOnRecipeV1, WorkflowStatus, BriefInput, ImageRef, RunwayLookStatus, RunwayPin, DropColour,
} from "@glamotion/contracts";

export interface ProfileRow { id: string; displayName: string; email: string; isPlatformAdmin: boolean; createdAt: string; deletedAt: string | null }
export interface OrganizationRow { id: string; slug: string; name: string; kind: "brand" | "agency"; status: "active" | "suspended"; createdAt: string }
export interface MembershipRow { id: string; organizationId: string; userId: string; role: Role; status: "active" | "revoked"; createdAt: string }
export interface BrandRow { id: string; organizationId: string; name: string; slug: string }
export interface ProductRow {
  id: string; organizationId: string; brandId: string; slug: string; title: string; category: CosmeticCategory;
  description: string; instructions: string; ingredients: string; warnings: string; status: ProductStatus;
  imageAlt: string; image: ImageRef | null; createdAt: string; updatedAt: string; publishedAt: string | null;
}
export interface VariantRow {
  id: string; organizationId: string; productId: string; sku: string; shadeName: string; hex: string; finish: Finish;
  defaultOpacity: number; sizeLabel: string | null; priceMinor: number; currency: string; active: boolean; createdAt: string; updatedAt: string;
}
export interface InventoryRow { variantId: string; organizationId: string; onHand: number; reserved: number }
export interface InventoryMovementRow { id: string; variantId: string; organizationId: string; delta: number; reason: string; refId: string | null; createdAt: string }
export interface CartRow { id: string; userId: string; createdAt: string; updatedAt: string }
export interface CartItemRow { id: string; cartId: string; variantId: string; quantity: number }
export interface CheckoutSessionRow {
  id: string; userId: string; cartId: string; idempotencyKey: string; requestHash: string; totalMinor: number; currency: string;
  providerSessionId: string; orderId: string; status: "open" | "completed" | "expired"; createdAt: string;
}
export interface OrderRow { id: string; userId: string; status: OrderStatus; totalMinor: number; taxMinor: number; currency: string; createdAt: string; paidAt: string | null }
export interface OrderItemRow {
  id: string; orderId: string; organizationId: string; variantId: string; productTitle: string; shadeName: string; sizeLabel: string | null; sku: string;
  unitPriceMinor: number; quantity: number; taxMinor: number; discountMinor: number; currency: string;
}
export interface OrderEventRow { id: string; orderId: string; from: OrderStatus | null; to: OrderStatus; actor: string; createdAt: string }
export interface PaymentEventRow { providerEventId: string; type: string; orderId: string | null; receivedAt: string; processed: boolean }
export interface LookRow { id: string; userId: string; name: string; recipe: TryOnRecipeV1; createdAt: string }
export interface PhotoConsentRow { id: string; userId: string; policyVersion: string; scope: "camera_session" | "store_photo" | "cloud_generation"; granted: boolean; createdAt: string }
export interface ProjectRow { id: string; organizationId: string; name: string; clientName: string; status: ProjectStatus; createdBy: string; createdAt: string }
export interface BriefRow { id: string; organizationId: string; projectId: string; input: BriefInput; confirmedByClient: boolean; createdAt: string }
export interface CompositionRow { id: string; organizationId: string; projectId: string | null; productId: string | null; title: string; headRevision: number; createdBy: string; createdAt: string; updatedAt: string }
export interface SceneVersionRow { compositionId: string; organizationId: string; revision: number; doc: MotionComposition; createdBy: string; createdAt: string }
export interface ReviewSessionRow {
  id: string; organizationId: string; projectId: string; compositionId: string; revision: number; tokenHash: string;
  reviewerName: string; canApprove: boolean; expiresAt: string; revokedAt: string | null; createdBy: string; createdAt: string;
}
export interface AnnotationRow { id: string; organizationId: string; reviewSessionId: string; compositionId: string; revision: number; frame: number | null; elementId: string | null; body: string; authorLabel: string; resolved: boolean; createdAt: string }
export interface ApprovalRow { id: string; organizationId: string; compositionId: string; revision: number; reviewSessionId: string | null; decision: "approved" | "changes_requested"; actorLabel: string; note: string | null; createdAt: string }
export interface DeliveryRow { id: string; organizationId: string; compositionId: string; revision: number; renderJobId: string; checksum: string; createdAt: string }
export interface RenderJobRow {
  id: string; organizationId: string; compositionId: string; revision: number; status: RenderStatus; quality: "preview" | "final";
  idempotencyKey: string; attempts: number; maxAttempts: number; lockedBy: string | null; lockedAt: string | null; availableAt: string;
  progress: number; outputKey: string | null; checksum: string | null; error: string | null; createdBy: string; createdAt: string; updatedAt: string;
}
export interface OutboxRow { id: string; topic: string; organizationId: string | null; payload: Record<string, unknown>; createdAt: string; dispatchedAt: string | null }
export interface CampaignRow { id: string; organizationId: string; productId: string; name: string; status: string; workflowId: string | null; compositionId: string | null; createdBy: string; createdAt: string; input: Record<string, unknown> }
export interface WorkflowRow { id: string; organizationId: string; kind: string; status: WorkflowStatus; invokedBy: string; correlationId: string; state: Record<string, unknown>; tokensUsed: number; maxTokens: number; createdAt: string; updatedAt: string }
export interface StepRow { id: string; workflowId: string; organizationId: string; key: string; agent: string | null; status: WorkflowStatus | "needs_review"; attempts: number; inputHash: string | null; outputHash: string | null; error: string | null; startedAt: string | null; finishedAt: string | null }
export interface AgentArtifactRow { id: string; workflowId: string; stepKey: string; organizationId: string; promptId: string; promptVersion: number; output: unknown; createdAt: string }
export interface HumanApprovalRow { id: string; workflowId: string; organizationId: string; gateId: string; status: "pending" | "approved" | "rejected"; decidedBy: string | null; selection: string | null; note: string | null; createdAt: string; decidedAt: string | null }
export interface UsageRow { id: string; organizationId: string; kind: "llm_tokens" | "render_seconds" | "images"; quantity: number; refId: string; createdAt: string }
export interface AuditRow { id: string; organizationId: string | null; actorId: string | null; action: string; entity: string; entityId: string | null; meta: Record<string, string | number | boolean | null>; createdAt: string }
export interface AnalyticsRow { id: string; name: string; userId: string | null; organizationId: string | null; props: Record<string, string | number | boolean>; createdAt: string }
export interface DeletionRequestRow { id: string; userId: string; status: "pending" | "completed"; createdAt: string; completedAt: string | null }
export interface MediaObjectRow { key: string; organizationId: string | null; ownerUserId: string | null; mime: string; bytes: number; checksum: string; privacyClass: "product_public" | "creative_private" | "face_private"; createdAt: string }

export interface RunwayLookRow {
  id: string; organizationId: string; name: string; description: string; position: number; status: RunwayLookStatus;
  image: ImageRef | null; pins: RunwayPin[]; createdBy: string; createdAt: string; updatedAt: string;
}

export interface DropRowData { image: ImageRef | null; colours: DropColour[] }
export interface DropPostRow {
  id: string; organizationId: string; title: string; position: number; status: RunwayLookStatus;
  top: DropRowData; bottom: DropRowData; createdBy: string; createdAt: string; updatedAt: string;
}

export class MemoryStore {
  profiles = new Map<string, ProfileRow>();
  organizations = new Map<string, OrganizationRow>();
  memberships = new Map<string, MembershipRow>();
  brands = new Map<string, BrandRow>();
  products = new Map<string, ProductRow>();
  variants = new Map<string, VariantRow>();
  inventories = new Map<string, InventoryRow>();
  inventoryMovements: InventoryMovementRow[] = [];
  carts = new Map<string, CartRow>();
  cartItems = new Map<string, CartItemRow>();
  checkoutSessions = new Map<string, CheckoutSessionRow>();
  orders = new Map<string, OrderRow>();
  orderItems: OrderItemRow[] = [];
  orderEvents: OrderEventRow[] = [];
  paymentEvents = new Map<string, PaymentEventRow>();
  looks = new Map<string, LookRow>();
  photoConsents: PhotoConsentRow[] = [];
  projects = new Map<string, ProjectRow>();
  briefs = new Map<string, BriefRow>();
  compositions = new Map<string, CompositionRow>();
  sceneVersions: SceneVersionRow[] = [];
  reviewSessions = new Map<string, ReviewSessionRow>();
  annotations: AnnotationRow[] = [];
  approvals: ApprovalRow[] = [];
  deliveries: DeliveryRow[] = [];
  renderJobs = new Map<string, RenderJobRow>();
  outbox: OutboxRow[] = [];
  campaigns = new Map<string, CampaignRow>();
  workflows = new Map<string, WorkflowRow>();
  steps: StepRow[] = [];
  artifacts: AgentArtifactRow[] = [];
  humanApprovals: HumanApprovalRow[] = [];
  usage: UsageRow[] = [];
  audit: AuditRow[] = [];
  analytics: AnalyticsRow[] = [];
  deletionRequests: DeletionRequestRow[] = [];
  media = new Map<string, MediaObjectRow>();
  runwayLooks = new Map<string, RunwayLookRow>();
  dropPosts = new Map<string, DropPostRow>();
}
