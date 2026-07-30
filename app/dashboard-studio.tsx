"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from "react";
import {
  AlertCircle,
  ArrowRight,
  Bell,
  Check,
  ChevronRight,
  Copy,
  CreditCard,
  Download,
  Film,
  Image as ImageIcon,
  Layers3,
  LogOut,
  MessageSquareText,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  Trash2,
  Upload,
  Video,
  WandSparkles,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { normalizeAssetMimeType } from "@/src/lib/assets";
import { ApiRequestError, requestJson } from "@/src/lib/client-api";
import {
  calculateGenerationCost,
  DEFAULT_DURATION_OPTION_ID,
  DURATION_OPTIONS,
  getDurationOption,
  getDurationOptionBySeconds,
  RESOLUTION_OPTIONS,
  type DurationOptionId,
  type GenerationMode,
  type ResolutionKey,
} from "@/src/lib/generation-config";
import {
  shouldUseResumableUpload,
  uploadResumably,
} from "@/src/lib/resumable-upload";
import { createClient } from "@/src/lib/supabase/client";

type View = "home" | "dashboard" | "auth";
type Section = "Create" | "My videos" | "Assets" | "Billing" | "Settings";
type ModeLabel = "Text to video" | "Image to video" | "Video to video";

type Wallet = {
  available_credits: number;
  reserved_credits: number;
  lifetime_purchased: number;
  lifetime_spent: number;
};

type GenerationPreset = {
  action: GenerationMode;
  credit_cost: number;
  description: string | null;
  fps: number;
  guidance_scale: number;
  id: string;
  inference_steps: number;
  name: string;
  slug: string;
};

type GenerationJob = {
  action: GenerationMode;
  actual_duration_seconds?: number | null;
  aspect_ratio: string;
  completed_at?: string | null;
  created_at: string;
  credit_cost: number;
  duration_seconds: number;
  error_message?: string | null;
  fps: number;
  frames: number;
  generation_presets?: { name?: string; slug?: string } | null;
  height: number;
  id: string;
  negative_prompt?: string | null;
  output_url?: string | null;
  output_fps?: number | null;
  output_frames?: number | null;
  preset_id: string;
  progress_percent: number;
  prompt: string;
  request_snapshot?: {
    configuration?: {
      duration_option?: DurationOptionId;
      duration_seconds?: number;
      fps?: number;
      resolution_key?: ResolutionKey;
    };
  } | null;
  requested_duration_seconds: number;
  runpod_delay_ms?: number | null;
  runpod_execution_ms?: number | null;
  seed?: number | null;
  source_asset_id?: string | null;
  started_at?: string | null;
  status: string;
  submitted_at?: string | null;
  title?: string | null;
  width: number;
};

type Asset = {
  bucket: string;
  created_at: string;
  id: string;
  kind: "source_image" | "source_video" | "avatar";
  mime_type: string;
  original_name: string | null;
  size_bytes: number;
  status: string;
  storage_path: string;
  url: string | null;
};

type UploadState = {
  active: boolean;
  completed: number;
  currentName: string;
  progress: number;
  stage: "uploading" | "verifying";
  total: number;
};

type CreditPackage = {
  base_credits: number;
  bonus_credits: number;
  currency: string;
  description?: string | null;
  id: string;
  name: string;
  price_minor: number;
};

type CreditTransaction = {
  available_balance_after: number;
  created_at: string;
  credit_delta: number;
  description?: string | null;
  id: string;
  transaction_type: string;
};

type UserProfile = {
  avatarUrl: string | null;
  company: string;
  displayName: string;
  email: string;
  emailNotifications: boolean;
  generationNotifications: boolean;
  id: string;
  referralCode: string;
};

type Notification = {
  action_url?: string | null;
  created_at: string;
  id: string;
  message: string;
  read_at?: string | null;
  title: string;
  type: string;
};

const MODE_ACTIONS: Record<ModeLabel, GenerationMode> = {
  "Text to video": "text_to_video",
  "Image to video": "image_to_video",
  "Video to video": "video_to_video",
};

const ACTION_LABELS: Record<GenerationMode, ModeLabel> = {
  text_to_video: "Text to video",
  image_to_video: "Image to video",
  video_to_video: "Video to video",
};

const SECTION_QUERY: Record<Section, string> = {
  Create: "create",
  "My videos": "videos",
  Assets: "assets",
  Billing: "billing",
  Settings: "settings",
};

const ACTIVE_STATUSES = new Set(["created", "reserving", "queued", "processing"]);

function emptyUploadState(): UploadState {
  return {
    active: false,
    completed: 0,
    currentName: "",
    progress: 0,
    stage: "uploading",
    total: 0,
  };
}

function wait(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function initialDashboardSection(): Section {
  if (typeof window === "undefined") return "Create";
  const requested = new URLSearchParams(window.location.search).get("section");
  return (
    (Object.entries(SECTION_QUERY) as Array<[Section, string]>).find(
      ([, value]) => value === requested,
    )?.[0] ?? "Create"
  );
}

function initials(value: string) {
  return value
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function formatBytes(value: number) {
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDuration(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function jobTimingLabel(job: GenerationJob, now: number) {
  const providerDuration =
    Number(job.runpod_delay_ms ?? 0) + Number(job.runpod_execution_ms ?? 0);
  if (job.status === "completed" && providerDuration > 0) {
    return `Render time ${formatDuration(providerDuration)}`;
  }

  const startedAt = new Date(job.submitted_at || job.created_at).getTime();
  const endedAt = job.completed_at ? new Date(job.completed_at).getTime() : now;
  const label = job.status === "completed" ? "Render time" : "Elapsed";
  return `${label} ${formatDuration(Math.max(0, endedAt - startedAt))}`;
}

function completedDurationSeconds(job: GenerationJob) {
  if (
    job.status === "completed" &&
    job.actual_duration_seconds !== null &&
    job.actual_duration_seconds !== undefined
  ) {
    return job.actual_duration_seconds;
  }

  return job.requested_duration_seconds || job.duration_seconds;
}

function formatVideoDuration(seconds: number) {
  return Number.isInteger(seconds)
    ? `${seconds}s`
    : `${seconds.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}s`;
}

function statusTone(status: string) {
  if (status === "completed") return "green";
  if (["failed", "timed_out"].includes(status)) return "purple";
  if (status === "cancelled") return "muted";
  return "yellow";
}

function DashboardLogo({ onHome }: { onHome: () => void }) {
  return (
    <button className="logo" onClick={onHome} type="button">
      <span className="logo-mark">
        <Sparkles size={17} />
      </span>
      <span>Morphly</span>
      <em>LTX 2.3</em>
    </button>
  );
}

function DashboardSide({
  active,
  onHome,
  onNavigate,
  profile,
}: {
  active: Section;
  onHome: () => void;
  onNavigate: (section: Section) => void;
  profile: UserProfile | null;
}) {
  const items: Array<[Section, LucideIcon]> = [
    ["Create", WandSparkles],
    ["My videos", Film],
    ["Assets", Layers3],
    ["Billing", CreditCard],
    ["Settings", Settings],
  ];
  const name = profile?.displayName || profile?.email || "Morphly creator";

  return (
    <aside className="side">
      <DashboardLogo onHome={onHome} />
      <div className="side-label">STUDIO</div>
      {items.map(([label, Icon]) => (
        <button
          className={active === label ? "active" : ""}
          key={label}
          onClick={() => onNavigate(label)}
          type="button"
        >
          <Icon size={18} />
          {label}
        </button>
      ))}
      <div className="side-bottom">
        <div className="mini-user">
          <span>{initials(name)}</span>
          <div>
            <b>{name}</b>
            <small>Morphly creator</small>
          </div>
        </div>
        <button onClick={onHome} type="button">
          <ArrowRight className="rotate" size={17} /> Back to site
        </button>
      </div>
    </aside>
  );
}

function MediaPreview({
  asset,
  className = "",
}: {
  asset: Asset;
  className?: string;
}) {
  if (!asset.url) {
    return (
      <div className={`asset-media-missing ${className}`}>
        <AlertCircle />
      </div>
    );
  }

  return asset.kind === "source_video" ? (
    <video className={className} controls muted playsInline preload="metadata" src={asset.url} />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={asset.original_name || "Uploaded asset"} className={className} src={asset.url} />
  );
}

export function DashboardStudio({
  setView,
}: {
  setView: (value: View) => void;
}) {
  const [active, setActive] = useState<Section>(initialDashboardSection);
  const [mode, setMode] = useState<ModeLabel>("Text to video");
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [presets, setPresets] = useState<GenerationPreset[]>([]);
  const [activePresetId, setActivePresetId] = useState("");
  const [jobs, setJobs] = useState<GenerationJob[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [resolutionKey, setResolutionKey] = useState<ResolutionKey>("landscape-720");
  const [durationOptionId, setDurationOptionId] = useState<DurationOptionId>(
    DEFAULT_DURATION_OPTION_ID,
  );
  const [seed, setSeed] = useState("");
  const [sourceAssetIds, setSourceAssetIds] = useState({
    image_to_video: "",
    video_to_video: "",
  });
  const [selectedJobId, setSelectedJobId] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [enhancingPrompt, setEnhancingPrompt] = useState(false);
  const [uploadStates, setUploadStates] = useState<
    Record<Asset["kind"], UploadState>
  >({
    avatar: emptyUploadState(),
    source_image: emptyUploadState(),
    source_video: emptyUploadState(),
  });
  const [checkoutId, setCheckoutId] = useState("");
  const [studioError, setStudioError] = useState("");
  const [notice, setNotice] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [clock, setClock] = useState(() => Date.now());

  const assetInputRef = useRef<HTMLInputElement>(null);
  const jobsRefreshInFlight = useRef(false);

  const modeAction = MODE_ACTIONS[mode];
  const modePresets = useMemo(
    () => presets.filter((preset) => preset.action === modeAction),
    [modeAction, presets],
  );
  const activePreset =
    modePresets.find((preset) => preset.id === activePresetId) ?? modePresets[0] ?? null;
  const durationOption =
    getDurationOption(durationOptionId) ??
    getDurationOption(DEFAULT_DURATION_OPTION_ID)!;
  const durationSeconds = durationOption.seconds;
  const fps = activePreset ? Number(activePreset.fps) : 0;
  const matchingAssets = useMemo(
    () =>
      assets.filter((asset) =>
        modeAction === "image_to_video"
          ? asset.kind === "source_image"
          : modeAction === "video_to_video" && asset.kind === "source_video",
      ),
    [assets, modeAction],
  );
  const sourceAssetId =
    modeAction === "image_to_video"
      ? sourceAssetIds.image_to_video
      : modeAction === "video_to_video"
        ? sourceAssetIds.video_to_video
        : "";
  const sourceAsset = matchingAssets.find((asset) => asset.id === sourceAssetId) ?? null;
  const activeUploadKind =
    modeAction === "image_to_video"
      ? "source_image"
      : modeAction === "video_to_video"
        ? "source_video"
        : null;
  const activeUploadState = activeUploadKind ? uploadStates[activeUploadKind] : null;
  const uploading = Object.values(uploadStates).some((state) => state.active);
  const creatorUploading = activeUploadState?.active ?? false;
  const selectedJob =
    jobs.find((job) => job.id === selectedJobId) ??
    jobs.find((job) => ACTIVE_STATUSES.has(job.status)) ??
    jobs.find((job) => job.status === "completed") ??
    jobs[0] ??
    null;
  const estimatedCost = activePreset
    ? calculateGenerationCost({
        durationSeconds,
        fps,
        mode: modeAction,
        presetSlug: activePreset.slug,
        resolutionKey,
      })
    : null;
  const unreadNotifications = notifications.filter((item) => !item.read_at).length;
  const userName = profile?.displayName || profile?.email || "Creator";
  const userInitials = initials(userName);
  const hasActiveJobs = jobs.some((job) => ACTIVE_STATUSES.has(job.status));

  function handleUnauthorized(error: unknown) {
    if (error instanceof ApiRequestError && error.status === 401) {
      setView("auth");
      return true;
    }
    return false;
  }

  async function loadDashboard() {
    try {
      const [
        walletData,
        presetData,
        jobData,
        assetData,
        profileData,
        notificationData,
        packageData,
        transactionData,
      ] = await Promise.all([
        requestJson<Wallet>("/api/wallet"),
        requestJson<GenerationPreset[]>("/api/generation/presets"),
        requestJson<GenerationJob[]>("/api/generation/jobs"),
        requestJson<Asset[]>("/api/assets"),
        requestJson<UserProfile>("/api/profile"),
        requestJson<Notification[]>("/api/notifications"),
        requestJson<CreditPackage[]>("/api/billing/packages"),
        requestJson<CreditTransaction[]>("/api/wallet/transactions"),
      ]);

      setWallet(walletData);
      setPresets(presetData);
      setJobs(jobData);
      setAssets(assetData);
      setProfile(profileData);
      setNotifications(notificationData);
      setPackages(packageData);
      setTransactions(transactionData);
      setStudioError("");
    } catch (error) {
      if (handleUnauthorized(error)) return;
      setStudioError(error instanceof Error ? error.message : "Unable to load your studio.");
    } finally {
      setLoading(false);
    }
  }

  async function refreshJobsAndWallet() {
    if (jobsRefreshInFlight.current) return;
    jobsRefreshInFlight.current = true;
    try {
      const [jobData, walletData, notificationData] = await Promise.all([
        requestJson<GenerationJob[]>("/api/generation/jobs"),
        requestJson<Wallet>("/api/wallet"),
        requestJson<Notification[]>("/api/notifications"),
      ]);
      setJobs(jobData);
      setWallet(walletData);
      setNotifications(notificationData);
    } catch (error) {
      if (!handleUnauthorized(error)) {
        setStudioError(error instanceof Error ? error.message : "Unable to refresh render status.");
      }
    } finally {
      jobsRefreshInFlight.current = false;
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDashboard();
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hasActiveJobs) return;
    const timer = window.setInterval(() => {
      void refreshJobsAndWallet();
    }, 2000);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void refreshJobsAndWallet();
      }
    };
    window.addEventListener("focus", refreshWhenVisible);
    window.addEventListener("online", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshWhenVisible);
      window.removeEventListener("online", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasActiveJobs]);

  useEffect(() => {
    if (!hasActiveJobs) return;
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [hasActiveJobs]);

  function navigate(section: Section) {
    setActive(section);
    setSearchOpen(false);
    setNotificationsOpen(false);
    const url = new URL(window.location.href);
    url.searchParams.set("view", "dashboard");
    url.searchParams.set("section", SECTION_QUERY[section]);
    window.history.replaceState(null, "", url);
  }

  async function handleEnhancePrompt() {
    if (!prompt.trim() || prompt.length < 3) {
      setStudioError("Please enter a short prompt first to enhance it.");
      return;
    }
    
    setStudioError("");
    setEnhancingPrompt(true);
    
    try {
      const res = await fetch("/api/generation/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt })
      });
      
      if (res.ok) {
        const data = await res.json() as { enhancedPrompt?: string };
        setPrompt(data.enhancedPrompt ?? "");
        // refresh wallet to reflect charged credits
        void refreshJobsAndWallet();
      } else {
        const errorData = await res.json() as { error?: string };
        setStudioError(errorData.error || "Failed to enhance prompt.");
      }
    } catch (e) {
      setStudioError("An unexpected error occurred while enhancing the prompt.");
    } finally {
      setEnhancingPrompt(false);
    }
  }

  function chooseMode(nextMode: ModeLabel) {
    setMode(nextMode);
    setActivePresetId("");
  }

  function selectSourceAsset(action: GenerationMode, assetId: string) {
    if (action === "image_to_video" || action === "video_to_video") {
      setSourceAssetIds((current) => ({
        ...current,
        [action]: assetId,
      }));
    }
  }

  function goHome() {
    const url = new URL(window.location.href);
    url.searchParams.delete("view");
    url.searchParams.delete("section");
    window.history.replaceState(null, "", url);
    setView("home");
  }

  function updateUploadState(
    kind: Asset["kind"],
    update: Partial<UploadState>,
  ) {
    setUploadStates((current) => ({
      ...current,
      [kind]: {
        ...current[kind],
        ...update,
      },
    }));
  }

  async function completeAssetUpload(assetId: string) {
    let lastError: unknown = null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await requestJson<{ asset: Asset }>(
          `/api/assets/${assetId}/complete`,
          {
            method: "POST",
            signal: AbortSignal.timeout(25_000),
          },
        );
      } catch (error) {
        lastError = error;
        if (
          error instanceof ApiRequestError &&
          [400, 401, 404].includes(error.status)
        ) {
          throw error;
        }
        if (attempt < 2) {
          await wait(500 * (attempt + 1));
        }
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error("The uploaded file could not be verified.");
  }

  async function uploadSingleAsset(
    file: File,
    resolvedKind: Asset["kind"],
    onProgress: (progress: number) => void,
  ) {
    const contentType = normalizeAssetMimeType(file.name, file.type);
    const initialized = await requestJson<{
      asset: Asset;
      upload: { bucket: string; path: string; token: string };
    }>("/api/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: file.name,
        kind: resolvedKind,
        mimeType: contentType,
        sizeBytes: file.size,
      }),
    });

    if (shouldUseResumableUpload(file)) {
      await uploadResumably({
        bucket: initialized.upload.bucket,
        contentType,
        file,
        onProgress,
        path: initialized.upload.path,
        token: initialized.upload.token,
      });
    } else {
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from(initialized.upload.bucket)
        .uploadToSignedUrl(initialized.upload.path, initialized.upload.token, file, {
          cacheControl: "3600",
          contentType,
        });
      if (uploadError) throw uploadError;
      onProgress(100);
    }

    updateUploadState(resolvedKind, { progress: 100, stage: "verifying" });
    return (await completeAssetUpload(initialized.asset.id)).asset;
  }

  async function uploadAssets(files: File[], kind?: Asset["kind"]) {
    if (!files.length) return;
    setStudioError("");
    setNotice("");

    const queue = files.map((file) => {
      const contentType = normalizeAssetMimeType(file.name, file.type);
      return {
        file,
        kind:
          kind ??
          (contentType.startsWith("image/")
            ? ("source_image" as const)
            : ("source_video" as const)),
      };
    });
    const successes: Asset[] = [];
    const failures: string[] = [];

    for (let index = 0; index < queue.length; index += 1) {
      const item = queue[index];
      updateUploadState(item.kind, {
        active: true,
        completed: index,
        currentName: item.file.name,
        progress: 0,
        stage: "uploading",
        total: queue.length,
      });

      try {
        const uploaded = await uploadSingleAsset(
          item.file,
          item.kind,
          (progress) => updateUploadState(item.kind, { progress }),
        );
        successes.push(uploaded);

        if (item.kind === "avatar") {
          const refreshedProfile = await requestJson<UserProfile>("/api/profile");
          setProfile(refreshedProfile);
        } else {
          setAssets((current) => [
            uploaded,
            ...current.filter((asset) => asset.id !== uploaded.id),
          ]);
          selectSourceAsset(
            item.kind === "source_image" ? "image_to_video" : "video_to_video",
            uploaded.id,
          );
        }
      } catch (error) {
        if (handleUnauthorized(error)) {
          return;
        }
        failures.push(
          error instanceof Error ? error.message : `${item.file.name} could not be uploaded.`,
        );
      } finally {
        updateUploadState(item.kind, {
          active: false,
          completed: index + 1,
          currentName: "",
          progress: 0,
          stage: "uploading",
        });
      }
    }

    if (successes.length) {
      const avatarOnly = successes.every((asset) => asset.kind === "avatar");
      setNotice(
        avatarOnly
          ? "Profile photo updated."
          : `${successes.length} ${successes.length === 1 ? "asset is" : "assets are"} ready to use.`,
      );
    }
    if (failures.length) {
      setStudioError(failures[0]);
    }
  }

  async function handleCreatorFiles(files: File[]) {
    if (!files.length || modeAction === "text_to_video") return;
    const uploadKind =
      modeAction === "image_to_video" ? "source_image" : "source_video";
    await uploadAssets(files, uploadKind);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    void handleCreatorFiles(Array.from(event.dataTransfer.files));
  }

  async function handleGenerate() {
    if (!activePreset || !estimatedCost || !prompt.trim()) {
      setStudioError("Add a prompt and choose an available preset.");
      return;
    }
    if (modeAction !== "text_to_video" && !sourceAsset) {
      setStudioError(
        modeAction === "image_to_video"
          ? "Upload or select a source image."
          : "Upload or select a source video.",
      );
      return;
    }
    if (wallet && wallet.available_credits < estimatedCost) {
      setStudioError("You do not have enough credits for this configuration.");
      return;
    }

    setSubmitting(true);
    setStudioError("");
    setNotice("");
    try {
      const result = await requestJson<{
        credit_cost: number;
        job_id: string;
        status: string;
      }>("/api/generation/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientRequestId: crypto.randomUUID(),
          presetId: activePreset.id,
          mode: modeAction,
          prompt: prompt.trim(),
          negativePrompt: negativePrompt.trim() || undefined,
          resolutionKey,
          durationOption: durationOption.id,
          seed: seed ? Number(seed) : null,
          sourceAssetId: sourceAsset?.id ?? null,
        }),
      });
      setSelectedJobId(result.job_id);
      await refreshJobsAndWallet();
      setNotice(`Render submitted. ${result.credit_cost.toLocaleString()} credits are reserved.`);
    } catch (error) {
      if (!handleUnauthorized(error)) {
        setStudioError(error instanceof Error ? error.message : "Generation request failed.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  function copyJobToCreator(job: GenerationJob) {
    const label = ACTION_LABELS[job.action];
    setMode(label);
    setPrompt(job.prompt);
    setNegativePrompt(job.negative_prompt || "");
    setSeed(job.seed === null || job.seed === undefined ? "" : String(job.seed));
    setActivePresetId(job.preset_id);
    const configuration = job.request_snapshot?.configuration;
    if (configuration?.resolution_key) setResolutionKey(configuration.resolution_key);
    const copiedDurationOption =
      (configuration?.duration_option &&
        getDurationOption(configuration.duration_option)) ||
      getDurationOptionBySeconds(
        configuration?.duration_seconds ||
          job.requested_duration_seconds ||
          job.duration_seconds,
      );
    if (copiedDurationOption) setDurationOptionId(copiedDurationOption.id);
    selectSourceAsset(job.action, job.source_asset_id || "");
    setSelectedJobId(job.id);
    navigate("Create");
    setNotice("Generation settings copied. Review them before submitting a new render.");
  }

  async function cancelJob(job: GenerationJob) {
    if (!window.confirm("Cancel this render and return its reserved credits?")) return;
    try {
      await requestJson<{ cancelled: boolean }>(
        `/api/generation/jobs/${job.id}/cancel`,
        { method: "POST" },
      );
      await refreshJobsAndWallet();
      setNotice("Render cancelled and reserved credits returned.");
    } catch (error) {
      setStudioError(error instanceof Error ? error.message : "The render could not be cancelled.");
    }
  }

  async function deleteJob(job: GenerationJob) {
    if (!window.confirm("Remove this generation from your library?")) return;
    try {
      await requestJson<void>(`/api/generation/jobs/${job.id}`, { method: "DELETE" });
      setJobs((current) => current.filter((item) => item.id !== job.id));
      if (selectedJobId === job.id) setSelectedJobId("");
      setNotice("Generation removed from your library.");
    } catch (error) {
      setStudioError(error instanceof Error ? error.message : "The generation could not be removed.");
    }
  }

  async function deleteAsset(asset: Asset) {
    if (!window.confirm(`Delete ${asset.original_name || "this asset"}?`)) return;
    try {
      await requestJson<void>(`/api/assets/${asset.id}`, { method: "DELETE" });
      setAssets((current) => current.filter((item) => item.id !== asset.id));
      setSourceAssetIds((current) => ({
        image_to_video:
          current.image_to_video === asset.id ? "" : current.image_to_video,
        video_to_video:
          current.video_to_video === asset.id ? "" : current.video_to_video,
      }));
      setNotice("Asset removed.");
    } catch (error) {
      setStudioError(error instanceof Error ? error.message : "The asset could not be deleted.");
    }
  }

  async function openCheckout(packageId: string) {
    setCheckoutId(packageId);
    setStudioError("");
    try {
      const result = await requestJson<{ checkoutUrl: string }>("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId }),
      });
      window.location.assign(result.checkoutUrl);
    } catch (error) {
      if (!handleUnauthorized(error)) {
        setStudioError(error instanceof Error ? error.message : "Checkout could not be opened.");
      }
      setCheckoutId("");
    }
  }

  async function markNotificationsRead() {
    if (!unreadNotifications) return;
    try {
      await requestJson<{ updated: boolean }>("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
      setNotifications((current) =>
        current.map((item) => ({ ...item, read_at: item.read_at || new Date().toISOString() })),
      );
    } catch {
      // Keep the notification panel usable if the acknowledgement fails.
    }
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    goHome();
  }

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];
    return [
      ...jobs
        .filter((job) => job.prompt.toLowerCase().includes(query))
        .slice(0, 5)
        .map((job) => ({
          id: job.id,
          label: job.title || job.prompt,
          meta: `Generation · ${job.status}`,
          kind: "job" as const,
        })),
      ...assets
        .filter((asset) => (asset.original_name || "").toLowerCase().includes(query))
        .slice(0, 5)
        .map((asset) => ({
          id: asset.id,
          label: asset.original_name || "Uploaded asset",
          meta: asset.kind.replaceAll("_", " "),
          kind: "asset" as const,
        })),
    ];
  }, [assets, jobs, searchQuery]);

  if (loading) {
    return (
      <div className="app-shell">
        <DashboardSide active={active} onHome={goHome} onNavigate={navigate} profile={profile} />
        <main className="app-main">
          <div className="dashboard-loading">
            <span className="spinner" />
            <b>Loading your Morphly studio…</b>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <DashboardSide active={active} onHome={goHome} onNavigate={navigate} profile={profile} />
      <main className="app-main">
        <header className="app-top">
          <button className="back-mobile" onClick={goHome} type="button">
            <X />
          </button>
          <div>
            <small>MORPHLY STUDIO</small>
            <h1>{active}</h1>
          </div>
          <div className="top-tools dashboard-top-tools">
            <div className="dashboard-popover-anchor">
              <button
                aria-label="Search generations and assets"
                onClick={() => {
                  setSearchOpen((value) => !value);
                  setNotificationsOpen(false);
                }}
                type="button"
              >
                <Search />
              </button>
              {searchOpen && (
                <div className="dashboard-popover search-popover">
                  <label>
                    <Search />
                    <input
                      autoFocus
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search videos and assets"
                      type="search"
                      value={searchQuery}
                    />
                  </label>
                  <div>
                    {searchQuery && !searchResults.length && (
                      <p className="empty-copy">No matching videos or assets.</p>
                    )}
                    {searchResults.map((result) => (
                      <button
                        key={`${result.kind}-${result.id}`}
                        onClick={() => {
                          if (result.kind === "job") {
                            setSelectedJobId(result.id);
                            navigate("My videos");
                          } else {
                            navigate("Assets");
                          }
                        }}
                        type="button"
                      >
                        {result.kind === "job" ? <Film /> : <Layers3 />}
                        <span>
                          <b>{result.label}</b>
                          <small>{result.meta}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="dashboard-popover-anchor">
              <button
                aria-label="Notifications"
                onClick={() => {
                  setNotificationsOpen((value) => !value);
                  setSearchOpen(false);
                  void markNotificationsRead();
                }}
                type="button"
              >
                <Bell />
                {unreadNotifications > 0 && <i />}
              </button>
              {notificationsOpen && (
                <div className="dashboard-popover notification-popover">
                  <div className="popover-title">
                    <b>Notifications</b>
                    <span>{unreadNotifications} unread</span>
                  </div>
                  {notifications.length ? (
                    notifications.map((notification) => (
                      <button
                        key={notification.id}
                        onClick={() => {
                          if (notification.type.startsWith("generation_")) {
                            navigate("My videos");
                          }
                        }}
                        type="button"
                      >
                        <i className={notification.read_at ? "read" : ""} />
                        <span>
                          <b>{notification.title}</b>
                          <small>{notification.message}</small>
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="empty-copy">No notifications yet.</p>
                  )}
                </div>
              )}
            </div>
            <button
              className="credit-pill"
              onClick={() => navigate("Billing")}
              type="button"
            >
              <Zap size={14} fill="currentColor" />
              <b>{wallet?.available_credits.toLocaleString() ?? "—"}</b> credits
            </button>
            <button
              aria-label="Open account settings"
              className="avatar"
              onClick={() => navigate("Settings")}
              type="button"
            >
              {profile?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="" src={profile.avatarUrl} />
              ) : (
                userInitials
              )}
            </button>
          </div>
        </header>

        {studioError && (
          <div className="dashboard-message error" role="alert">
            <AlertCircle />
            <span>{studioError}</span>
            <button aria-label="Dismiss error" onClick={() => setStudioError("")} type="button">
              <X />
            </button>
          </div>
        )}
        {notice && (
          <div className="dashboard-message success" role="status">
            <Check />
            <span>{notice}</span>
            <button aria-label="Dismiss message" onClick={() => setNotice("")} type="button">
              <X />
            </button>
          </div>
        )}

        {active === "Create" && (
          <section className="workspace">
            <div className="mode-tabs">
              {(Object.keys(MODE_ACTIONS) as ModeLabel[]).map((item) => (
                <button
                  className={mode === item ? "active" : ""}
                  key={item}
                  onClick={() => chooseMode(item)}
                  type="button"
                >
                  {item === "Text to video" ? (
                    <MessageSquareText />
                  ) : item === "Image to video" ? (
                    <ImageIcon />
                  ) : (
                    <Video />
                  )}
                  {item}
                </button>
              ))}
            </div>

            <div className="creator-grid">
              <section className="prompt-panel">
                <div className="panel-head">
                  <div>
                    <h2>{mode}</h2>
                    <small>{activePreset?.description || "Choose your render settings"}</small>
                  </div>
                  <span>{estimatedCost ? `${estimatedCost} credits` : "Unavailable"}</span>
                </div>

                {modeAction !== "text_to_video" && (
                  <div className="source-control">
                    <label
                      className={`dropzone ${sourceAsset && !creatorUploading ? "has-file" : ""}`}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={handleDrop}
                    >
                      {creatorUploading && activeUploadState ? (
                        <>
                          <RefreshCw className="spin" />
                          <b>
                            {activeUploadState.stage === "verifying"
                              ? "Verifying upload…"
                              : `Uploading ${activeUploadState.progress}%`}
                          </b>
                          <span>
                            {activeUploadState.total > 1
                              ? `${Math.min(activeUploadState.completed + 1, activeUploadState.total)} of ${activeUploadState.total} · ${activeUploadState.currentName}`
                              : activeUploadState.stage === "verifying"
                                ? "The file is in storage. Morphly is making it ready to use."
                                : "Keep this page open while the file is transferred."}
                          </span>
                          <span className="upload-progress-track">
                            <i
                              style={{
                                width: `${Math.max(3, activeUploadState.progress)}%`,
                              }}
                            />
                          </span>
                        </>
                      ) : sourceAsset ? (
                        <>
                          <MediaPreview asset={sourceAsset} />
                          <div>
                            <b>{sourceAsset.original_name}</b>
                            <span>{formatBytes(sourceAsset.size_bytes)} · click to replace</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <Upload />
                          <b>{`Upload ${modeAction === "image_to_video" ? "source images" : "a source video"}`}</b>
                          <span>
                            {modeAction === "image_to_video"
                              ? "Select one or more JPG, PNG or WebP files · max 15 MB each"
                              : "MP4, MOV or WebM · max 200 MB"}
                          </span>
                        </>
                      )}
                      <input
                        accept={modeAction === "image_to_video" ? "image/jpeg,image/png,image/webp" : "video/mp4,video/quicktime,video/webm"}
                        disabled={creatorUploading}
                        multiple={modeAction === "image_to_video"}
                        onChange={(event) => {
                          void handleCreatorFiles(Array.from(event.target.files ?? []));
                          event.currentTarget.value = "";
                        }}
                        type="file"
                      />
                    </label>
                    {matchingAssets.length > 0 && (
                      <div className="source-asset-library">
                        <div>
                          <b>
                            Your {modeAction === "image_to_video" ? "images" : "videos"}
                          </b>
                          <span>Select one source · {matchingAssets.length} stored</span>
                        </div>
                        <div className="source-asset-list">
                          {matchingAssets.map((asset) => (
                            <article
                              className={sourceAssetId === asset.id ? "selected" : ""}
                              key={asset.id}
                            >
                              <button
                                className="source-asset-choice"
                                onClick={() => selectSourceAsset(modeAction, asset.id)}
                                type="button"
                              >
                                <MediaPreview asset={asset} />
                                <span>{asset.original_name || "Untitled asset"}</span>
                                {sourceAssetId === asset.id && <Check />}
                              </button>
                              <button
                                aria-label={`Delete ${asset.original_name || "asset"}`}
                                className="source-asset-delete"
                                onClick={() => void deleteAsset(asset)}
                                type="button"
                              >
                                <Trash2 />
                              </button>
                            </article>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <label className="prompt-label">
                  <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Describe your scene <small>{prompt.length} / 1200</small></span>
                    <button 
                      type="button" 
                      onClick={handleEnhancePrompt} 
                      disabled={enhancingPrompt || prompt.length < 3}
                      className="enhance-btn"
                      style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--lime)', background: 'transparent', color: 'var(--lime)', cursor: enhancingPrompt || prompt.length < 3 ? 'not-allowed' : 'pointer', opacity: enhancingPrompt || prompt.length < 3 ? 0.5 : 1 }}
                    >
                      <WandSparkles size={14} />
                      {enhancingPrompt ? 'Enhancing...' : 'Enhance (10 Credits)'}
                    </button>
                  </span>
                  <textarea
                    maxLength={1200}
                    onChange={(event) => setPrompt(event.target.value)}
                    placeholder="Describe the subject, motion, camera, lighting, and atmosphere…"
                    value={prompt}
                  />
                </label>

                <div className="control-grid creator-controls">
                  <label>
                    Preset
                    <select
                      disabled={!modePresets.length}
                      onChange={(event) => setActivePresetId(event.target.value)}
                      value={activePreset?.id ?? ""}
                    >
                      {modePresets.length ? (
                        modePresets.map((preset) => (
                          <option key={preset.id} value={preset.id}>
                            {preset.name}
                          </option>
                        ))
                      ) : (
                        <option>No preset available</option>
                      )}
                    </select>
                  </label>
                  <label>
                    Resolution
                    <select
                      onChange={(event) => setResolutionKey(event.target.value as ResolutionKey)}
                      value={resolutionKey}
                    >
                      {RESOLUTION_OPTIONS.map((option) => (
                        <option key={option.key} value={option.key}>
                          {option.label} · {option.aspectRatio}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Duration
                    <select
                      onChange={(event) =>
                        setDurationOptionId(event.target.value as DurationOptionId)
                      }
                      value={durationOption.id}
                    >
                      {DURATION_OPTIONS.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Frame rate
                    <select value={fps || ""} onChange={() => {}}>
                      <option value={fps || ""}>
                        {fps ? `${fps} fps` : "Select a preset"}
                      </option>
                    </select>
                  </label>
                </div>

                <details className="advanced-controls">
                  <summary>Advanced controls</summary>
                  <label>
                    Negative prompt
                    <textarea
                      maxLength={1200}
                      onChange={(event) => setNegativePrompt(event.target.value)}
                      placeholder="Elements, artifacts, or styles to avoid…"
                      value={negativePrompt}
                    />
                  </label>
                  <label>
                    Seed <small>Leave blank for a random seed</small>
                    <input
                      inputMode="numeric"
                      min="0"
                      onChange={(event) => setSeed(event.target.value.replace(/\D/g, ""))}
                      placeholder="Random"
                      type="text"
                      value={seed}
                    />
                  </label>
                </details>

                <div className="estimate">
                  <span>
                    <Sparkles /> Estimated cost
                  </span>
                  <b>{estimatedCost ? `${estimatedCost} credits` : "Not available"}</b>
                </div>
                <button
                  className="generate-btn"
                  disabled={submitting || creatorUploading}
                  onClick={handleGenerate}
                  type="button"
                >
                  {submitting ? (
                    <>
                      <span className="spinner" /> Submitting render…
                    </>
                  ) : (
                    <>
                      <WandSparkles /> Generate video
                      <span>↵</span>
                    </>
                  )}
                </button>
              </section>

              <section className="preview-panel">
                <div className="panel-head">
                  <div>
                    <h2>Preview</h2>
                    <small>
                      {selectedJob
                        ? `${selectedJob.width} × ${selectedJob.height} · ${formatVideoDuration(completedDurationSeconds(selectedJob))}`
                        : "Your source or latest render appears here"}
                    </small>
                  </div>
                  <span>{selectedJob?.aspect_ratio || RESOLUTION_OPTIONS.find((item) => item.key === resolutionKey)?.aspectRatio}</span>
                </div>
                <div className="preview-screen real-preview">
                  {selectedJob?.output_url ? (
                    <video controls playsInline preload="metadata" src={selectedJob.output_url} />
                  ) : selectedJob && ACTIVE_STATUSES.has(selectedJob.status) ? (
                    <div className="generating">
                      <div className="gen-orbit">
                        <Sparkles />
                      </div>
                      <b>{selectedJob.status === "queued" ? "Waiting for a worker" : "Rendering your video"}</b>
                      <span>
                        {selectedJob.progress_percent}% · {jobTimingLabel(selectedJob, clock)} ·{" "}
                        {selectedJob.credit_cost} credits reserved
                      </span>
                      <div>
                        <i style={{ width: `${Math.max(4, selectedJob.progress_percent)}%` }} />
                      </div>
                    </div>
                  ) : sourceAsset ? (
                    <MediaPreview asset={sourceAsset} />
                  ) : (
                    <div className="preview-empty-real">
                      <Film />
                      <b>No preview yet</b>
                      <span>Upload a source or submit a render to review it here.</span>
                    </div>
                  )}
                </div>
                <div className="preview-actions">
                  {selectedJob?.output_url ? (
                    <a href={selectedJob.output_url} rel="noreferrer" target="_blank">
                      <Download /> Export
                    </a>
                  ) : (
                    <button disabled type="button">
                      <Download /> Export
                    </button>
                  )}
                  <button
                    disabled={!selectedJob}
                    onClick={() => selectedJob && copyJobToCreator(selectedJob)}
                    type="button"
                  >
                    <Copy /> New variation
                  </button>
                </div>
                {selectedJob?.error_message && (
                  <p className="preview-error">
                    <AlertCircle /> {selectedJob.error_message}
                  </p>
                )}
              </section>
            </div>

            <div className="recent-head">
              <div>
                <h2>Recent generations</h2>
                <p>Real render status from your Morphly account.</p>
              </div>
              <button onClick={() => navigate("My videos")} type="button">
                View all <ChevronRight />
              </button>
            </div>
            <JobGrid
              clock={clock}
              jobs={jobs.slice(0, 6)}
              onCopy={copyJobToCreator}
              onSelect={(job) => setSelectedJobId(job.id)}
              selectedJobId={selectedJob?.id || ""}
            />
          </section>
        )}

        {active === "My videos" && (
          <VideosPage
            clock={clock}
            jobs={jobs}
            onCancel={cancelJob}
            onCopy={copyJobToCreator}
            onDelete={deleteJob}
            onNew={() => navigate("Create")}
            onSelect={(job) => setSelectedJobId(job.id)}
            selectedJobId={selectedJobId}
          />
        )}

        {active === "Assets" && (
          <AssetsPage
            assets={assets.filter((asset) => asset.kind !== "avatar")}
            inputRef={assetInputRef}
            onDelete={deleteAsset}
            onFiles={(files) => void uploadAssets(files)}
            onUse={(asset) => {
              const action =
                asset.kind === "source_image" ? "image_to_video" : "video_to_video";
              setMode(
                action === "image_to_video" ? "Image to video" : "Video to video",
              );
              selectSourceAsset(action, asset.id);
              navigate("Create");
            }}
            uploading={uploading}
          />
        )}

        {active === "Billing" && (
          <BillingPage
            checkoutId={checkoutId}
            onCheckout={openCheckout}
            packages={packages}
            transactions={transactions}
            wallet={wallet}
          />
        )}

        {active === "Settings" && profile && (
          <SettingsPage
            key={`${profile.id}:${profile.displayName}:${profile.company}:${profile.emailNotifications}:${profile.generationNotifications}`}
            onAvatar={(file) => void uploadAssets([file], "avatar")}
            onProfile={setProfile}
            onSignOut={signOut}
            onSuccess={setNotice}
            profile={profile}
            uploading={uploadStates.avatar.active}
          />
        )}
      </main>
    </div>
  );
}

function JobGrid({
  clock,
  jobs,
  onCopy,
  onSelect,
  selectedJobId,
}: {
  clock: number;
  jobs: GenerationJob[];
  onCopy: (job: GenerationJob) => void;
  onSelect: (job: GenerationJob) => void;
  selectedJobId: string;
}) {
  if (!jobs.length) {
    return <p className="empty-copy dashboard-empty-copy">No generations yet. Your first render will appear here.</p>;
  }

  return (
    <div className="job-grid live-job-grid">
      {jobs.map((job) => (
        <article className={selectedJobId === job.id ? "selected" : ""} key={job.id}>
          <button className="job-card-main" onClick={() => onSelect(job)} type="button">
            <div className="job-thumb">
              {job.output_url ? (
                <video muted playsInline preload="metadata" src={job.output_url} />
              ) : ACTIVE_STATUSES.has(job.status) ? (
                <span className="job-progress">{job.progress_percent}%</span>
              ) : (
                <Play fill="currentColor" />
              )}
            </div>
            <div>
              <h3>{job.title || job.prompt}</h3>
              <p>
                {ACTION_LABELS[job.action]} · {formatVideoDuration(completedDurationSeconds(job))} · {job.width}×{job.height}
              </p>
              <span className={statusTone(job.status)}>{job.status.replaceAll("_", " ")}</span>
              <small className="job-timing">{jobTimingLabel(job, clock)}</small>
            </div>
          </button>
          <button aria-label="Use generation settings" onClick={() => onCopy(job)} type="button">
            <Copy />
          </button>
        </article>
      ))}
    </div>
  );
}

function VideosPage({
  clock,
  jobs,
  onCancel,
  onCopy,
  onDelete,
  onNew,
  onSelect,
  selectedJobId,
}: {
  clock: number;
  jobs: GenerationJob[];
  onCancel: (job: GenerationJob) => void;
  onCopy: (job: GenerationJob) => void;
  onDelete: (job: GenerationJob) => void;
  onNew: () => void;
  onSelect: (job: GenerationJob) => void;
  selectedJobId: string;
}) {
  const [filter, setFilter] = useState("all");
  const filtered = jobs.filter((job) => filter === "all" || job.status === filter);
  const selected = jobs.find((job) => job.id === selectedJobId) ?? filtered[0] ?? null;

  return (
    <section className="content-page videos-page">
      <div className="section-toolbar">
        <div>
          <h2>My videos</h2>
          <p>Review outputs, monitor progress, reuse settings, export, or remove renders.</p>
        </div>
        <div>
          <select onChange={(event) => setFilter(event.target.value)} value={filter}>
            <option value="all">All statuses</option>
            <option value="completed">Completed</option>
            <option value="processing">Processing</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <button className="lime-btn" onClick={onNew} type="button">
            <Plus /> New video
          </button>
        </div>
      </div>

      {!filtered.length ? (
        <div className="empty-state functional-empty">
          <div><Film /></div>
          <h2>No matching videos</h2>
          <p>Completed and active renders will appear here.</p>
          <button className="lime-btn" onClick={onNew} type="button">
            <Plus /> Create video
          </button>
        </div>
      ) : (
        <div className="video-library-layout">
          <div className="video-library-list">
            {filtered.map((job) => (
              <button
                className={selected?.id === job.id ? "selected" : ""}
                key={job.id}
                onClick={() => onSelect(job)}
                type="button"
              >
                <span className="library-thumb">
                  {job.output_url ? (
                    <video muted playsInline preload="metadata" src={job.output_url} />
                  ) : (
                    <Film />
                  )}
                </span>
                <span>
                  <b>{job.title || job.prompt}</b>
                  <small>{formatDate(job.created_at)} · {jobTimingLabel(job, clock)}</small>
                </span>
                <em className={statusTone(job.status)}>{job.status.replaceAll("_", " ")}</em>
              </button>
            ))}
          </div>
          {selected && (
            <article className="video-detail">
              <div className="video-detail-preview">
                {selected.output_url ? (
                  <video controls playsInline preload="metadata" src={selected.output_url} />
                ) : ACTIVE_STATUSES.has(selected.status) ? (
                  <div className="generating">
                    <RefreshCw />
                    <b>Render in progress</b>
                    <span>{selected.progress_percent}% complete · {jobTimingLabel(selected, clock)}</span>
                  </div>
                ) : (
                  <div className="preview-empty-real">
                    <AlertCircle />
                    <b>No output available</b>
                    <span>{selected.error_message || "This render did not produce a video."}</span>
                  </div>
                )}
              </div>
              <h2>{selected.title || selected.prompt}</h2>
              <p>{selected.prompt}</p>
              <div className="video-metadata">
                <span>{ACTION_LABELS[selected.action]}</span>
                <span>{selected.width} × {selected.height}</span>
                <span>
                  {selected.status === "completed" ? "Actual " : "Requested "}
                  {formatVideoDuration(completedDurationSeconds(selected))}
                </span>
                <span>{selected.output_fps ?? selected.fps} fps</span>
                <span>{selected.credit_cost} credits</span>
                <span>{jobTimingLabel(selected, clock)}</span>
              </div>
              <div className="video-actions">
                {selected.output_url && (
                  <a href={selected.output_url} rel="noreferrer" target="_blank">
                    <Download /> Download
                  </a>
                )}
                <button onClick={() => onCopy(selected)} type="button">
                  <Copy /> Use settings
                </button>
                {ACTIVE_STATUSES.has(selected.status) && (
                  <button className="danger" onClick={() => onCancel(selected)} type="button">
                    <X /> Cancel render
                  </button>
                )}
                {!ACTIVE_STATUSES.has(selected.status) && (
                  <button className="danger" onClick={() => onDelete(selected)} type="button">
                    <Trash2 /> Remove
                  </button>
                )}
              </div>
            </article>
          )}
        </div>
      )}
    </section>
  );
}

function AssetsPage({
  assets,
  inputRef,
  onDelete,
  onFiles,
  onUse,
  uploading,
}: {
  assets: Asset[];
  inputRef: React.RefObject<HTMLInputElement | null>;
  onDelete: (asset: Asset) => void;
  onFiles: (files: File[]) => void;
  onUse: (asset: Asset) => void;
  uploading: boolean;
}) {
  return (
    <section className="content-page assets-page">
      <input
        accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
        hidden
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length) onFiles(files);
          event.currentTarget.value = "";
        }}
        multiple
        ref={inputRef}
        type="file"
      />
      <div className="section-toolbar">
        <div>
          <h2>Assets</h2>
          <p>Your securely stored source images and footage.</p>
        </div>
        <button
          className="lime-btn"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          type="button"
        >
          <Upload /> {uploading ? "Uploading…" : "Upload asset"}
        </button>
      </div>

      {!assets.length ? (
        <div className="empty-state functional-empty">
          <div><Layers3 /></div>
          <h2>No uploaded assets</h2>
          <p>Upload an image or video once, then reuse it in future generations.</p>
          <button className="lime-btn" onClick={() => inputRef.current?.click()} type="button">
            <Plus /> Upload asset
          </button>
        </div>
      ) : (
        <div className="asset-grid">
          {assets.map((asset) => (
            <article key={asset.id}>
              <div className="asset-preview">
                <MediaPreview asset={asset} />
              </div>
              <div className="asset-copy">
                <b>{asset.original_name || "Untitled asset"}</b>
                <span>
                  {asset.kind === "source_image" ? "Image" : "Video"} · {formatBytes(asset.size_bytes)}
                </span>
              </div>
              <div className="asset-actions">
                <button onClick={() => onUse(asset)} type="button">
                  <WandSparkles /> Use in studio
                </button>
                <button
                  aria-label={`Delete ${asset.original_name || "asset"}`}
                  className="danger"
                  onClick={() => onDelete(asset)}
                  type="button"
                >
                  <Trash2 />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function BillingPage({
  checkoutId,
  onCheckout,
  packages,
  transactions,
  wallet,
}: {
  checkoutId: string;
  onCheckout: (id: string) => void;
  packages: CreditPackage[];
  transactions: CreditTransaction[];
  wallet: Wallet | null;
}) {
  return (
    <section className="content-page">
      <div className="stat-grid">
        <article>
          <span>Available credits</span>
          <b>{wallet?.available_credits.toLocaleString() ?? "—"}</b>
          <small>{wallet?.reserved_credits.toLocaleString() ?? 0} reserved</small>
        </article>
        <article>
          <span>Lifetime purchased</span>
          <b>{wallet?.lifetime_purchased.toLocaleString() ?? "—"}</b>
          <small>credits added through checkout</small>
        </article>
        <article>
          <span>Lifetime spent</span>
          <b>{wallet?.lifetime_spent.toLocaleString() ?? "—"}</b>
          <small>credits used on completed videos</small>
        </article>
      </div>

      <h2>Buy credits</h2>
      <div className="billing-packages">
        {packages.map((creditPackage) => (
          <article className="package-card" key={creditPackage.id}>
            <div>
              <h2>{creditPackage.name}</h2>
              <p>{creditPackage.description}</p>
              <strong>
                {creditPackage.base_credits.toLocaleString()} credits
                {creditPackage.bonus_credits > 0
                  ? ` + ${creditPackage.bonus_credits.toLocaleString()} bonus`
                  : ""}
              </strong>
              <span>
                {(creditPackage.price_minor / 100).toLocaleString(undefined, {
                  style: "currency",
                  currency: creditPackage.currency,
                })}
              </span>
            </div>
            <button
              className="lime-btn"
              disabled={Boolean(checkoutId)}
              onClick={() => onCheckout(creditPackage.id)}
              type="button"
            >
              {checkoutId === creditPackage.id ? "Opening checkout…" : "Buy credits"}
            </button>
          </article>
        ))}
      </div>

      <h2>Credit history</h2>
      <div className="table credit-history-table">
        {transactions.map((transaction) => (
          <div key={transaction.id}>
            <span>{new Date(transaction.created_at).toLocaleDateString()}</span>
            <span>{transaction.transaction_type.replaceAll("_", " ")}</span>
            <span className={transaction.credit_delta > 0 ? "positive" : "negative"}>
              {transaction.credit_delta > 0 ? "+" : ""}
              {transaction.credit_delta.toLocaleString()}
            </span>
            <span>{transaction.description ?? "Credit activity"}</span>
            <span>{transaction.available_balance_after.toLocaleString()}</span>
          </div>
        ))}
        {!transactions.length && <p className="empty-copy">No credit transactions yet.</p>}
      </div>
    </section>
  );
}

function SettingsPage({
  onAvatar,
  onProfile,
  onSignOut,
  onSuccess,
  profile,
  uploading,
}: {
  onAvatar: (file: File) => void;
  onProfile: (profile: UserProfile) => void;
  onSignOut: () => void;
  onSuccess: (message: string) => void;
  profile: UserProfile;
  uploading: boolean;
}) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [company, setCompany] = useState(profile.company);
  const [emailNotifications, setEmailNotifications] = useState(profile.emailNotifications);
  const [generationNotifications, setGenerationNotifications] = useState(profile.generationNotifications);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [settingsError, setSettingsError] = useState("");

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSettingsError("");
    try {
      const updated = await requestJson<UserProfile>("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          company,
          emailNotifications,
          generationNotifications,
        }),
      });
      onProfile(updated);
      onSuccess("Profile settings saved.");
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : "Profile settings could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 8 || password !== confirmPassword) {
      setSettingsError("Passwords must match and contain at least 8 characters.");
      return;
    }
    setSaving(true);
    setSettingsError("");
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) {
      setSettingsError(error.message);
      return;
    }
    setPassword("");
    setConfirmPassword("");
    onSuccess("Password updated.");
  }

  return (
    <section className="content-page settings-page functional-settings">
      {settingsError && <p className="form-error">{settingsError}</p>}
      <div className="wide-card profile-card">
        <span className="big-avatar">
          {profile.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt="" src={profile.avatarUrl} />
          ) : (
            initials(profile.displayName || profile.email)
          )}
        </span>
        <div>
          <h2>{profile.displayName}</h2>
          <p>{profile.email}</p>
          <small>Referral code: {profile.referralCode}</small>
        </div>
        <label className="profile-photo-button">
          {uploading ? "Uploading…" : "Change photo"}
          <input
            accept="image/jpeg,image/png,image/webp"
            disabled={uploading}
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onAvatar(file);
              event.currentTarget.value = "";
            }}
            type="file"
          />
        </label>
      </div>

      <div className="settings-grid">
        <form className="form-card" onSubmit={saveProfile}>
          <h2>Profile information</h2>
          <div className="control-grid">
            <label>
              Display name
              <input
                maxLength={80}
                minLength={2}
                onChange={(event) => setDisplayName(event.target.value)}
                required
                value={displayName}
              />
            </label>
            <label>
              Company
              <input
                maxLength={120}
                onChange={(event) => setCompany(event.target.value)}
                placeholder="Optional"
                value={company}
              />
            </label>
            <label>
              Email address
              <input disabled type="email" value={profile.email} />
            </label>
          </div>
          <div className="preference-list">
            <label>
              <input
                checked={generationNotifications}
                onChange={(event) => setGenerationNotifications(event.target.checked)}
                type="checkbox"
              />
              <span>
                <b>Generation notifications</b>
                <small>Notify me when a render completes or fails.</small>
              </span>
            </label>
            <label>
              <input
                checked={emailNotifications}
                onChange={(event) => setEmailNotifications(event.target.checked)}
                type="checkbox"
              />
              <span>
                <b>Email notifications</b>
                <small>Allow important Morphly account email updates.</small>
              </span>
            </label>
          </div>
          <button className="lime-btn" disabled={saving} type="submit">
            {saving ? "Saving…" : "Save changes"}
          </button>
        </form>

        <form className="form-card" onSubmit={changePassword}>
          <h2>Security</h2>
          <label>
            New password
            <input
              autoComplete="new-password"
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          <label>
            Confirm new password
            <input
              autoComplete="new-password"
              minLength={8}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              type="password"
              value={confirmPassword}
            />
          </label>
          <button className="lime-btn" disabled={saving} type="submit">
            Update password
          </button>
          <button className="settings-signout" onClick={onSignOut} type="button">
            <LogOut /> Sign out of Morphly
          </button>
        </form>
      </div>
    </section>
  );
}
