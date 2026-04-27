CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "user_ai_gateway_key" (
	"user_id" text PRIMARY KEY NOT NULL,
	"ciphertext" text NOT NULL,
	"key_last4" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_wallet" (
	"user_id" text NOT NULL,
	"chain_id" text NOT NULL,
	"address" text NOT NULL,
	"verified_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_wallet_user_id_chain_id_pk" PRIMARY KEY("user_id","chain_id")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallet_link_challenge" (
	"user_id" text PRIMARY KEY NOT NULL,
	"nonce" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_message" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"role" text NOT NULL,
	"parts" jsonb NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_agent" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text,
	"model_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_job" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"required_model_id" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"client_user_id" text NOT NULL,
	"provider_user_id" text,
	"accepted_bid_id" text,
	"delivery_payload" jsonb,
	"submitted_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"provider_payout_address" text,
	"acp_job_id" text,
	"acp_chain_id" text DEFAULT '2368' NOT NULL,
	"acp_contract_address" text,
	"acp_client_address" text,
	"acp_provider_address" text,
	"acp_evaluator_address" text,
	"acp_description" text,
	"acp_budget" text,
	"acp_expires_at" timestamp with time zone,
	"acp_status" text,
	"acp_hook_address" text,
	"deliverable_commitment" text,
	"last_chain_sync_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_job_bid" (
	"id" text PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"provider_user_id" text NOT NULL,
	"amount" text NOT NULL,
	"currency" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"provider_wallet_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_ai_gateway_key" ADD CONSTRAINT "user_ai_gateway_key_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_wallet" ADD CONSTRAINT "user_wallet_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_link_challenge" ADD CONSTRAINT "wallet_link_challenge_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_message" ADD CONSTRAINT "agent_message_agent_id_user_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."user_agent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_agent" ADD CONSTRAINT "user_agent_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_job" ADD CONSTRAINT "agent_job_client_user_id_user_id_fk" FOREIGN KEY ("client_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_job" ADD CONSTRAINT "agent_job_provider_user_id_user_id_fk" FOREIGN KEY ("provider_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_job_bid" ADD CONSTRAINT "agent_job_bid_job_id_agent_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."agent_job"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_job_bid" ADD CONSTRAINT "agent_job_bid_provider_user_id_user_id_fk" FOREIGN KEY ("provider_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_wallet_chain_address_unique" ON "user_wallet" USING btree ("chain_id","address");--> statement-breakpoint
CREATE INDEX "user_wallet_chain_idx" ON "user_wallet" USING btree ("chain_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "wallet_link_challenge_expires_idx" ON "wallet_link_challenge" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "agent_message_agent_idx" ON "agent_message" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "agent_message_agent_created_idx" ON "agent_message" USING btree ("agent_id","created_at");--> statement-breakpoint
CREATE INDEX "user_agent_user_idx" ON "user_agent" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "agent_job_client_idx" ON "agent_job" USING btree ("client_user_id");--> statement-breakpoint
CREATE INDEX "agent_job_model_idx" ON "agent_job" USING btree ("required_model_id");--> statement-breakpoint
CREATE INDEX "agent_job_status_idx" ON "agent_job" USING btree ("status");--> statement-breakpoint
CREATE INDEX "agent_job_acp_job_idx" ON "agent_job" USING btree ("acp_job_id");--> statement-breakpoint
CREATE INDEX "agent_job_bid_job_idx" ON "agent_job_bid" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "agent_job_bid_provider_idx" ON "agent_job_bid" USING btree ("provider_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_job_bid_job_provider_unique" ON "agent_job_bid" USING btree ("job_id","provider_user_id");