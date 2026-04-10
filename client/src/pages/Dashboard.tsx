import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf/dist/jspdf.es.min.js";
import axios from "axios";
import { useTheme } from "../ThemeContext";

interface User {
  id: string;
  name: string;
  email: string;
}

interface Application {
  _id: string;
  company: string;
  role: string;
  jdLink?: string;
  notes?: string;
  dateApplied?: string;
  followUpDate?: string;
  status: string;
  salary?: string | number;
}

interface ParsedJobData {
  company: string;
  role: string;
  skillsRequired: string[];
  skillsOptional: string[];
  seniority: string;
  location: string;
  resumePoints: string[];
}

interface FollowUpReminder {
  app: Application;
  dueDate: Date;
  daysUntilDue: number;
  urgency: "overdue" | "today" | "upcoming";
}

const statusColumns = [
  { key: "Applied", label: "Applied" },
  { key: "Phone Screen", label: "Phone Screen" },
  { key: "Interview", label: "Interview" },
  { key: "Offer", label: "Offer" },
  { key: "Rejected", label: "Rejected" },
];

const statusTagStyles: Record<string, string> = {
  applied: "bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300",
  "phone screen": "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  interview: "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300",
  offer: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  rejected: "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300",
};

const normalizeStatus = (status: string) => {
  const normalized = status.trim().toLowerCase();

  if (normalized === "offered" || normalized === "accepted") {
    return "offer";
  }

  if (normalized === "interviewing") {
    return "interview";
  }

  return normalized;
};

const formatDate = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const REMINDER_DISMISS_KEY = "dismissedFollowUpReminders";

const getStartOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const Dashboard = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const token = localStorage.getItem("token");

  const [user, setUser] = useState<User | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [jdLink, setJdLink] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("Applied");
  const [salary, setSalary] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  const [draggedApp, setDraggedApp] = useState<Application | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const [jobDescription, setJobDescription] = useState("");
  const [parsingJD, setParsingJD] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedJobData | null>(null);
  const [aiError, setAiError] = useState("");
  const [copiedPointIndex, setCopiedPointIndex] = useState<number | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [dismissedReminderIds, setDismissedReminderIds] = useState<string[]>(() => {
    const raw = localStorage.getItem(REMINDER_DISMISS_KEY);
    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const fetchApplications = async () => {
    if (!token) return;

    try {
      setLoading(true);
      const res = await axios.get("http://localhost:5000/api/applications", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setApplications(res.data);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to fetch applications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const storedUser = localStorage.getItem("user");

    if (!storedUser || !token) {
      navigate("/login");
      return;
    }

    try {
      setUser(JSON.parse(storedUser));
    } catch {
      localStorage.removeItem("user");
      localStorage.removeItem("token");
      navigate("/login");
      return;
    }

    fetchApplications();
  }, [navigate, token]);

  const filteredApplications = useMemo(() => {
    return applications.filter((app) => {
      const matchesSearch =
        app.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.role.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        filterStatus === "all" ||
        normalizeStatus(app.status) === normalizeStatus(filterStatus);

      return matchesSearch && matchesStatus;
    });
  }, [applications, searchTerm, filterStatus]);

  const groupedApplications = useMemo(() => {
    return statusColumns.reduce((acc, column) => {
      acc[column.key] = filteredApplications.filter(
        (app) => normalizeStatus(app.status) === normalizeStatus(column.key)
      );
      return acc;
    }, {} as Record<string, Application[]>);
  }, [filteredApplications]);

  const followUpReminders = useMemo(() => {
    const today = getStartOfDay(new Date());
    const sevenDaysFromNow = new Date(today);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    return applications
      .filter((app) => app.followUpDate && !dismissedReminderIds.includes(app._id))
      .map((app) => {
        const dueDate = getStartOfDay(new Date(app.followUpDate as string));
        const diffInDays = Math.round(
          (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );

        let urgency: FollowUpReminder["urgency"] = "upcoming";
        if (diffInDays < 0) urgency = "overdue";
        if (diffInDays === 0) urgency = "today";

        return {
          app,
          dueDate,
          daysUntilDue: diffInDays,
          urgency,
        };
      })
      .filter((item) => {
        if (item.urgency === "overdue" || item.urgency === "today") {
          return true;
        }
        return item.dueDate <= sevenDaysFromNow;
      })
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }, [applications, dismissedReminderIds]);

  const upcomingFollowUps = useMemo(() => {
    const today = new Date();

    return applications
      .filter((app) => app.followUpDate)
      .map((app) => ({
        ...app,
        dueDate: new Date(app.followUpDate as string),
      }))
      .filter((app) => !Number.isNaN(app.dueDate.getTime()) && app.dueDate >= today)
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
      .slice(0, 4);
  }, [applications]);

  const reminderStats = useMemo(() => {
    return {
      overdue: followUpReminders.filter((item) => item.urgency === "overdue").length,
      today: followUpReminders.filter((item) => item.urgency === "today").length,
      upcoming: followUpReminders.filter((item) => item.urgency === "upcoming").length,
    };
  }, [followUpReminders]);

  const stats = useMemo(
    () => ({
      total: applications.length,
      applied: applications.filter(
        (app) => normalizeStatus(app.status) === "applied"
      ).length,
      phoneScreen: applications.filter(
        (app) => normalizeStatus(app.status) === "phone screen"
      ).length,
      interviewing: applications.filter(
        (app) => normalizeStatus(app.status) === "interview"
      ).length,
      offered: applications.filter(
        (app) => normalizeStatus(app.status) === "offer"
      ).length,
      rejected: applications.filter(
        (app) => normalizeStatus(app.status) === "rejected"
      ).length,
      followUps: upcomingFollowUps.length,
    }),
    [applications, upcomingFollowUps]
  );

  const isInitialLoading = loading && applications.length === 0;
  const hasNoApplications = !loading && applications.length === 0;
  const hasNoFilteredResults = !loading && applications.length > 0 && filteredApplications.length === 0;

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const dismissReminder = (appId: string) => {
    setDismissedReminderIds((prev) => {
      if (prev.includes(appId)) return prev;
      const next = [...prev, appId];
      localStorage.setItem(REMINDER_DISMISS_KEY, JSON.stringify(next));
      return next;
    });
  };

  const resetDismissedReminders = () => {
    setDismissedReminderIds([]);
    localStorage.removeItem(REMINDER_DISMISS_KEY);
  };

  const resetForm = () => {
    setCompany("");
    setRole("");
    setJdLink("");
    setNotes("");
    setStatus("Applied");
    setSalary("");
    setFollowUpDate("");
    setEditingId(null);
    setError("");
  };

  const handleEditApplication = (app: Application) => {
    setCompany(app.company || "");
    setRole(app.role || "");
    setJdLink(app.jdLink || "");
    setNotes(app.notes || "");
    setStatus(app.status || "Applied");
    setSalary(app.salary !== undefined ? String(app.salary) : "");
    setFollowUpDate(app.followUpDate ? app.followUpDate.slice(0, 10) : "");
    setEditingId(app._id);

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleAddOrUpdateApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const payload = {
      company,
      role,
      jdLink,
      notes,
      status,
      salary: salary ? String(salary) : undefined,
      followUpDate: followUpDate || undefined,
    };

    try {
      if (!token) {
        navigate("/login");
        return;
      }

      if (editingId) {
        await axios.put(
          `http://localhost:5000/api/applications/${editingId}`,
          payload,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
      } else {
        await axios.post("http://localhost:5000/api/applications", payload, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }

      resetForm();
      await fetchApplications();
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          (editingId
            ? "Failed to update application"
            : "Failed to create application")
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteApplication = async (id: string) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this application?"
    );

    if (!confirmDelete || !token) return;

    try {
      await axios.delete(`http://localhost:5000/api/applications/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setApplications((prev) => prev.filter((app) => app._id !== id));

      if (editingId === id) {
        resetForm();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to delete application");
    }
  };

  const updateApplicationStatus = async (app: Application, newStatus: string) => {
    if (app.status === newStatus || !token) return;

    try {
      setUpdatingStatusId(app._id);

      await axios.put(
        `http://localhost:5000/api/applications/${app._id}`,
        {
          company: app.company,
          role: app.role,
          jdLink: app.jdLink,
          notes: app.notes,
          status: newStatus,
          salary: app.salary,
          followUpDate: app.followUpDate,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setApplications((prev) =>
        prev.map((item) =>
          item._id === app._id ? { ...item, status: newStatus } : item
        )
      );

      if (editingId === app._id) {
        setStatus(newStatus);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to update status");
    } finally {
      setUpdatingStatusId(null);
      setDraggedApp(null);
      setDragOverColumn(null);
    }
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, app: Application) => {
    e.dataTransfer.setData("application/id", app._id);
    e.dataTransfer.effectAllowed = "move";
    setDraggedApp(app);
  };

  const handleDragEnd = () => {
    setDraggedApp(null);
    setDragOverColumn(null);
  };

  const handleDragOverColumn = (
    e: React.DragEvent<HTMLDivElement>,
    columnKey: string
  ) => {
    e.preventDefault();
    setDragOverColumn(columnKey);
  };

  const handleDropOnColumn = async (
    e: React.DragEvent<HTMLDivElement>,
    columnKey: string
  ) => {
    e.preventDefault();
    let droppedApp = draggedApp;
    const appId = e.dataTransfer.getData("application/id");

    if (!droppedApp && appId) {
      droppedApp = applications.find((item) => item._id === appId) || null;
    }

    if (!droppedApp) return;
    await updateApplicationStatus(droppedApp, columnKey);
  };

  const handleParseJD = async () => {
    if (!jobDescription.trim()) {
      setAiError("Please paste a job description");
      return;
    }

    if (!token) {
      navigate("/login");
      return;
    }

    try {
      setAiError("");
      setParsingJD(true);
      setParsedData(null);
      setCopiedPointIndex(null);

      const res = await axios.post(
        "http://localhost:5000/api/ai/parse-jd",
        {
          jobDescription,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setParsedData(res.data.data);
    } catch (err: any) {
      setAiError(err.response?.data?.message || "Failed to parse job description");
    } finally {
      setParsingJD(false);
    }
  };

  const handleUseParsedData = () => {
    if (!parsedData) return;

    setCompany(parsedData.company || "");
    setRole(parsedData.role || "");
    setStatus("Applied");

    const generatedNotes = [
      parsedData.location ? `Location: ${parsedData.location}` : "",
      parsedData.seniority ? `Seniority: ${parsedData.seniority}` : "",
      parsedData.skillsRequired?.length
        ? `Required Skills: ${parsedData.skillsRequired.join(", ")}`
        : "",
      parsedData.skillsOptional?.length
        ? `Optional Skills: ${parsedData.skillsOptional.join(", ")}`
        : "",
      parsedData.resumePoints?.length
        ? `Resume Points:\n- ${parsedData.resumePoints.join("\n- ")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    setNotes(generatedNotes);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCopyResumePoint = async (point: string, index: number) => {
    try {
      await navigator.clipboard.writeText(point);
      setCopiedPointIndex(index);
      setTimeout(() => {
        setCopiedPointIndex(null);
      }, 1500);
    } catch {
      setAiError("Failed to copy resume point");
    }
  };

  const handleCopyAllResumePoints = async () => {
    if (!parsedData) return;
    const text = parsedData.resumePoints.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopiedPointIndex(-1);
      setTimeout(() => setCopiedPointIndex(null), 1500);
    } catch {
      setAiError("Failed to copy all resume points");
    }
  };

  const exportToCSV = () => {
    const rows = [
      ["Company", "Role", "Status", "Salary", "Follow-up Date", "JD Link", "Notes"],
      ...filteredApplications.map((app) => [
        app.company,
        app.role,
        app.status,
        app.salary ?? "",
        app.followUpDate ? formatDate(app.followUpDate) : "",
        app.jdLink ?? "",
        app.notes ? app.notes.replace(/\n/g, " ") : "",
      ]),
    ];

    const csvContent = rows
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "applications_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportToPDF = () => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const title = "AI Job Tracker Export";
    const x = 40;
    let y = 60;

    doc.setFontSize(18);
    doc.text(title, x, y);
    y += 30;

    doc.setFontSize(11);
    const headers = ["Company", "Role", "Status", "Salary", "Follow-up", "JD Link"];
    doc.text(headers.join("  |  "), x, y);
    y += 20;
    doc.setDrawColor(150);
    doc.line(x, y - 8, 560, y - 8);

    filteredApplications.forEach((app) => {
      if (y > 740) {
        doc.addPage();
        y = 60;
      }
      const row = [
        app.company,
        app.role,
        app.status,
        app.salary ? String(app.salary) : "",
        app.followUpDate ? formatDate(app.followUpDate) : "",
        app.jdLink ? app.jdLink : "",
      ];
      doc.text(row.join("  |  "), x, y);
      y += 18;
    });

    doc.save("applications_export.pdf");
  };

  const exportToDoc = () => {
    const header = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Applications Export</title></head><body><h1>AI Job Tracker Export</h1><table border="1" style="border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; font-size: 12px;"><thead><tr><th style="padding:8px; background:#111827; color:#f8fafc;">Company</th><th style="padding:8px; background:#111827; color:#f8fafc;">Role</th><th style="padding:8px; background:#111827; color:#f8fafc;">Status</th><th style="padding:8px; background:#111827; color:#f8fafc;">Salary</th><th style="padding:8px; background:#111827; color:#f8fafc;">Follow-up</th><th style="padding:8px; background:#111827; color:#f8fafc;">JD Link</th><th style="padding:8px; background:#111827; color:#f8fafc;">Notes</th></tr></thead><tbody>${filteredApplications
      .map((app) => `<tr><td style="padding:8px; border:1px solid #334155;">${app.company}</td><td style="padding:8px; border:1px solid #334155;">${app.role}</td><td style="padding:8px; border:1px solid #334155;">${app.status}</td><td style="padding:8px; border:1px solid #334155;">${app.salary ?? ""}</td><td style="padding:8px; border:1px solid #334155;">${app.followUpDate ? formatDate(app.followUpDate) : ""}</td><td style="padding:8px; border:1px solid #334155;">${app.jdLink ?? ""}</td><td style="padding:8px; border:1px solid #334155;">${app.notes ? app.notes.replace(/\n/g, " ") : ""}</td></tr>`)
      .join("")}</tbody></table></body></html>`;

    const blob = new Blob([header], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "applications_export.doc");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (isInitialLoading) {
    return (
      <div className="min-h-screen w-full bg-gray-50 dark:bg-slate-950 py-10">
        <div className="mx-auto w-full max-w-full px-4 sm:px-6 lg:px-8">
          <div className="rounded-[2rem] border border-gray-200 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-8 shadow-[0_30px_120px_rgba(15,23,42,0.25)] backdrop-blur-2xl">
            <div className="space-y-3">
              <p className="text-sm uppercase tracking-[0.26em] text-sky-600 dark:text-sky-400">
                AI Job Tracker
              </p>
              <h1 className="text-3xl font-semibold text-black dark:text-white">
                Loading your dashboard...
              </h1>
              <p className="text-sm text-gray-600 dark:text-slate-400">
                Fetching your applications, reminders, and board data.
              </p>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[...Array(4)].map((_, index) => (
                <div
                  key={index}
                  className="h-28 animate-pulse rounded-3xl border border-gray-200 dark:border-white/10 bg-gray-200/80 dark:bg-slate-900/80"
                />
              ))}
            </div>
            <div className="mt-6 grid gap-4 xl:grid-cols-5">
              {[...Array(5)].map((_, index) => (
                <div
                  key={index}
                  className="min-h-[260px] animate-pulse rounded-[1.75rem] border border-gray-200 dark:border-slate-800 bg-gray-100/90 dark:bg-slate-950/90"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gray-50 dark:bg-slate-950 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.16),_transparent_24%),radial-gradient(circle_at_bottom_right,_rgba(168,85,247,0.18),_transparent_22%)] py-10">
      <div className="mx-auto w-full max-w-full px-4 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[2rem] border border-gray-200 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 shadow-[0_30px_120px_rgba(15,23,42,0.35)] backdrop-blur-2xl">
          <div className="bg-gray-100/90 dark:bg-slate-950/90 px-6 py-6 sm:px-8 sm:py-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-[0.26em] text-sky-600 dark:text-sky-400">
                  AI Job Tracker
                </p>
                <h1 className="text-4xl font-semibold tracking-tight text-black dark:text-white">
                  Your Job Pipeline, Elevated
                </h1>
                {user && (
                  <p className="max-w-2xl text-gray-600 dark:text-slate-400">
                    Welcome back, <span className="font-semibold text-black dark:text-white">{user.name}</span>. Track every application, parse JDs, and build resume-ready bullets with a high-performance dashboard.
                  </p>
                )}
              </div>

              <div className="flex flex-col items-start gap-3 sm:items-end">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={toggleTheme}
                    className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-purple-500 px-4 py-2 text-sm font-semibold text-white shadow-lg transition duration-200 hover:scale-[1.01] hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-gray-50 dark:focus:ring-offset-slate-950"
                  >
                    {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-rose-500 via-fuchsia-500 to-pink-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-500/20 transition duration-200 hover:scale-[1.01] hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-rose-400 focus:ring-offset-2 focus:ring-offset-slate-950"
                  >
                    Logout
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-slate-500">Signed in as {user?.email}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-6 px-6 pb-8 pt-8 sm:px-8 lg:grid-cols-[1.4fr_0.95fr] lg:gap-8">
            <section className="space-y-6">
              {error && (
                <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-rose-700 dark:text-rose-200">{error}</p>
                    <button
                      type="button"
                      onClick={fetchApplications}
                      className="rounded-full bg-rose-500 px-4 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-white transition hover:bg-rose-400"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-3xl border border-gray-200 dark:border-white/10 bg-gray-200/80 dark:bg-slate-900/80 p-6 shadow-[0_16px_80px_-35px_rgba(15,23,42,0.8)]">
                  <p className="text-sm text-gray-600 dark:text-slate-400">Total Applications</p>
                  <p className="mt-4 text-4xl font-semibold text-black dark:text-white">{stats.total}</p>
                </div>
                <div className="rounded-3xl border border-gray-200 dark:border-white/10 bg-gray-200/80 dark:bg-slate-900/80 p-6 shadow-[0_16px_80px_-35px_rgba(15,23,42,0.8)]">
                  <p className="text-sm text-gray-600 dark:text-slate-400">Applied</p>
                  <p className="mt-4 text-4xl font-semibold text-sky-600 dark:text-sky-300">{stats.applied}</p>
                </div>
                <div className="rounded-3xl border border-gray-200 dark:border-white/10 bg-gray-200/80 dark:bg-slate-900/80 p-6 shadow-[0_16px_80px_-35px_rgba(15,23,42,0.8)]">
                  <p className="text-sm text-gray-600 dark:text-slate-400">Phone Screens</p>
                  <p className="mt-4 text-4xl font-semibold text-amber-600 dark:text-amber-300">{stats.phoneScreen}</p>
                </div>
                <div className="rounded-3xl border border-gray-200 dark:border-white/10 bg-gray-200/80 dark:bg-slate-900/80 p-6 shadow-[0_16px_80px_-35px_rgba(15,23,42,0.8)]">
                  <p className="text-sm text-gray-600 dark:text-slate-400">Upcoming Follow-ups</p>
                  <p className="mt-4 text-4xl font-semibold text-emerald-600 dark:text-emerald-300">{stats.followUps}</p>
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                <article className="rounded-[2rem] border border-gray-200 dark:border-white/10 bg-gray-100/90 dark:bg-slate-950/90 p-6 shadow-[0_18px_120px_-40px_rgba(15,23,42,0.7)]">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <h2 className="text-xl font-semibold text-black dark:text-white">AI Job Description Parser</h2>
                      <p className="mt-2 text-sm text-gray-600 dark:text-slate-400">
                        Paste a JD and generate skills, role details, and resume bullets instantly.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 rounded-3xl border border-white/10 bg-slate-950/80 p-2 shadow-sm shadow-slate-950/20">
                      <button
                        type="button"
                        onClick={exportToCSV}
                        className="inline-flex items-center justify-center rounded-2xl bg-gray-300 dark:bg-slate-800 px-6 py-2 text-sm font-semibold uppercase tracking-[0.08em] text-black dark:text-slate-100 shadow-lg shadow-slate-900/25 transition duration-200 hover:bg-gray-400 dark:hover:bg-slate-700 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 focus:ring-offset-gray-50 dark:focus:ring-offset-slate-950"
                      >
                        CSV
                      </button>
                      <button
                        type="button"
                        onClick={exportToPDF}
                        className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-sky-500 via-cyan-500 to-blue-600 px-6 py-2 text-sm font-semibold uppercase tracking-[0.08em] text-white shadow-lg shadow-sky-500/25 transition duration-200 hover:brightness-110 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2 focus:ring-offset-gray-50 dark:focus:ring-offset-slate-950"
                      >
                        PDF
                      </button>
                      <button
                        type="button"
                        onClick={exportToDoc}
                        className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 px-6 py-2 text-sm font-semibold uppercase tracking-[0.08em] text-white shadow-lg shadow-violet-500/25 transition duration-200 hover:brightness-110 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-2 focus:ring-offset-slate-950"
                      >
                        DOC
                      </button>
                    </div>
                  </div>

                  <textarea
                    placeholder="Paste job description here..."
                    className="mt-6 min-h-[180px] w-full rounded-3xl border border-white/10 bg-slate-900/80 p-4 text-slate-100 outline-none transition focus:border-sky-400"
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                  />

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={handleParseJD}
                      disabled={parsingJD}
                      className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 px-6 py-3 text-sm font-semibold uppercase tracking-[0.06em] text-white shadow-xl shadow-sky-500/20 transition duration-200 hover:brightness-110 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2 focus:ring-offset-slate-950"
                    >
                      {parsingJD ? "Parsing..." : "Parse JD"}
                    </button>
                    {parsedData && (
                      <button
                        type="button"
                        onClick={handleUseParsedData}
                        className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 px-6 py-3 text-sm font-semibold uppercase tracking-[0.06em] text-white shadow-xl shadow-violet-500/20 transition duration-200 hover:brightness-110 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-2 focus:ring-offset-slate-950"
                      >
                        Use parsed data
                      </button>
                    )}
                  </div>

                  {aiError && <p className="mt-4 text-sm text-rose-400">{aiError}</p>}
                  {parsedData && <p className="mt-4 text-sm text-emerald-300">✅ Parsed successfully!</p>}

                  {parsedData && (
                    <div className="mt-6 rounded-[1.75rem] border border-white/10 bg-slate-900/85 p-5">
                      <div className="grid gap-4 lg:grid-cols-2">
                        <div className="space-y-3 text-slate-100">
                          <p><span className="font-semibold text-white">Company:</span> {parsedData.company}</p>
                          <p><span className="font-semibold text-white">Role:</span> {parsedData.role}</p>
                          <p><span className="font-semibold text-white">Seniority:</span> {parsedData.seniority}</p>
                          <p><span className="font-semibold text-white">Location:</span> {parsedData.location}</p>
                        </div>
                        <div className="space-y-4">
                          <div>
                            <p className="font-semibold text-slate-100">Required Skills</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {parsedData.skillsRequired.map((skill, index) => (
                                <span key={index} className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700 dark:bg-sky-900 dark:text-sky-300">
                                  {skill}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="font-semibold text-slate-100">Optional Skills</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {parsedData.skillsOptional.map((skill, index) => (
                                <span key={index} className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                                  {skill}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/10 bg-slate-950/90 p-4">
                        <p className="font-semibold text-slate-100">Resume bullets ready for copy</p>
                        <button
                          type="button"
                          onClick={handleCopyAllResumePoints}
                          className="rounded-full bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-indigo-500/20 transition duration-200 hover:bg-indigo-400 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-slate-950"
                        >
                          Copy all bullets
                        </button>
                      </div>

                      <div className="mt-6 space-y-3">
                        <p className="font-semibold text-slate-100">Resume Points</p>
                        {parsedData.resumePoints.map((point, index) => (
                          <div key={index} className="rounded-3xl border border-white/10 bg-slate-950/90 p-4">
                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                              <p className="text-sm leading-6 text-slate-300">{point}</p>
                              <button
                                type="button"
                                onClick={() => handleCopyResumePoint(point, index)}
                                className="rounded-full bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-indigo-500/20 transition duration-200 hover:bg-indigo-400 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-slate-950"
                              >
                                {copiedPointIndex === index ? "Copied" : "Copy"}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </article>

                <article className="rounded-[2rem] border border-white/10 bg-slate-950/90 p-6 shadow-[0_18px_120px_-40px_rgba(15,23,42,0.7)]">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-semibold text-white">Quick Actions</h2>
                      <p className="mt-3 text-sm text-slate-400">
                        Save time by adding a new application, exporting data, or tracking follow-ups.
                      </p>
                    </div>
                  </div>
                  <div className="mt-6 grid gap-4">
                    <div className="rounded-3xl bg-slate-900/80 p-4">
                      <p className="text-sm text-slate-400">Fast add</p>
                      <p className="mt-2 text-lg font-semibold text-white">Add job entries and reminders fast.</p>
                    </div>
                    <div className="rounded-3xl bg-slate-900/80 p-4">
                      <p className="text-sm text-slate-400">Smart bullets</p>
                      <p className="mt-2 text-lg font-semibold text-white">Generate resume-proof points from any JD.</p>
                    </div>
                    <div className="rounded-3xl bg-slate-900/80 p-4">
                      <p className="text-sm text-slate-400">Follow-up reminders</p>
                      <p className="mt-2 text-lg font-semibold text-white">See the next important dates in one glance.</p>
                    </div>
                  </div>
                </article>
              </div>
            </section>

            <section className="space-y-6">
              <div className="rounded-[2rem] border border-white/10 bg-slate-950/90 p-6 shadow-[0_18px_120px_-40px_rgba(15,23,42,0.7)]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-slate-400">Application form</p>
                    <h2 className="mt-1 text-2xl font-semibold text-white">
                      {editingId ? "Update opportunity" : "New application"}
                    </h2>
                  </div>
                  {editingId && (
                    <span className="rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-slate-950">
                      Editing
                    </span>
                  )}
                </div>

                <form onSubmit={handleAddOrUpdateApplication} className="mt-6 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <input
                      type="text"
                      placeholder="Company"
                      className="w-full rounded-3xl border border-white/10 bg-slate-900/80 p-4 text-slate-100 outline-none transition focus:border-sky-400"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      required
                    />
                    <input
                      type="text"
                      placeholder="Role"
                      className="w-full rounded-3xl border border-white/10 bg-slate-900/80 p-4 text-slate-100 outline-none transition focus:border-sky-400"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      required
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <input
                      type="text"
                      placeholder="JD Link"
                      className="w-full rounded-3xl border border-white/10 bg-slate-900/80 p-4 text-slate-100 outline-none transition focus:border-sky-400"
                      value={jdLink}
                      onChange={(e) => setJdLink(e.target.value)}
                    />
                    <input
                      type="number"
                      placeholder="Salary"
                      className="w-full rounded-3xl border border-white/10 bg-slate-900/80 p-4 text-slate-100 outline-none transition focus:border-sky-400"
                      value={salary}
                      onChange={(e) => setSalary(e.target.value)}
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <select
                      className="w-full rounded-3xl border border-white/10 bg-slate-900/80 p-4 text-slate-100 outline-none transition focus:border-sky-400"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      <option value="Applied">Applied</option>
                      <option value="Phone Screen">Phone Screen</option>
                      <option value="Interview">Interview</option>
                      <option value="Offer">Offer</option>
                      <option value="Rejected">Rejected</option>
                    </select>
                    <input
                      type="date"
                      className="w-full rounded-3xl border border-white/10 bg-slate-900/80 p-4 text-slate-100 outline-none transition focus:border-sky-400"
                      value={followUpDate}
                      onChange={(e) => setFollowUpDate(e.target.value)}
                    />
                  </div>

                  <textarea
                    placeholder="Notes"
                    className="w-full min-h-[180px] rounded-3xl border border-white/10 bg-slate-900/80 p-4 text-slate-100 outline-none transition focus:border-sky-400"
                    rows={6}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />

                  {error && <p className="text-sm text-rose-400">{error}</p>}

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/15 transition duration-200 hover:bg-emerald-400 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-950"
                    >
                      {submitting
                        ? editingId
                          ? "Updating application"
                          : "Adding application"
                        : editingId
                        ? "Save changes"
                        : "Add application"}
                    </button>
                    {editingId && (
                      <button
                        type="button"
                        onClick={resetForm}
                        className="inline-flex items-center justify-center rounded-full bg-slate-800 px-5 py-3 text-sm font-semibold text-slate-200 shadow-sm shadow-slate-900/40 transition duration-200 hover:bg-slate-700 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 focus:ring-offset-slate-950"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>

              <div className="rounded-[2rem] border border-white/10 bg-slate-950/90 p-6 shadow-[0_18px_120px_-40px_rgba(15,23,42,0.7)]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-white">Board controls</h2>
                    <p className="mt-3 text-sm text-slate-400">Filter, search and move cards to keep your pipeline tidy and action-focused.</p>
                  </div>
                </div>
                <div className="mt-6 space-y-4">
                  <input
                    type="text"
                    placeholder="Search by company or role..."
                    className="w-full rounded-3xl border border-white/10 bg-slate-900/80 p-4 text-slate-100 outline-none transition focus:border-sky-400"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <select
                    className="w-full rounded-3xl border border-white/10 bg-slate-900/80 p-4 text-slate-100 outline-none transition focus:border-sky-400"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                  >
                    <option value="all">All statuses</option>
                    {statusColumns.map((column) => (
                      <option key={column.key} value={column.key}>
                        {column.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="rounded-[2rem] border border-white/10 bg-slate-950/90 p-6 shadow-[0_18px_120px_-40px_rgba(15,23,42,0.7)]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-white">Reminders for follow-ups</h2>
                    <p className="mt-3 text-sm text-slate-400">Priority reminders for overdue, today, and next 7 days follow-ups.</p>
                  </div>
                  {dismissedReminderIds.length > 0 && (
                    <button
                      type="button"
                      onClick={resetDismissedReminders}
                      className="rounded-full bg-slate-800 px-3 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-slate-200 transition hover:bg-slate-700"
                    >
                      Restore dismissed
                    </button>
                  )}
                </div>

                <div className="mt-5 grid grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3">
                    <p className="text-xs uppercase tracking-[0.08em] text-rose-300">Overdue</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{reminderStats.overdue}</p>
                  </div>
                  <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3">
                    <p className="text-xs uppercase tracking-[0.08em] text-amber-300">Today</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{reminderStats.today}</p>
                  </div>
                  <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-3">
                    <p className="text-xs uppercase tracking-[0.08em] text-sky-300">Next 7 Days</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{reminderStats.upcoming}</p>
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  {hasNoApplications ? (
                    <p className="text-sm text-slate-400">No applications yet, so reminders will appear here after your first entry.</p>
                  ) : followUpReminders.length === 0 ? (
                    <p className="text-sm text-slate-400">No active reminders. Add follow-up dates or restore dismissed reminders.</p>
                  ) : (
                    followUpReminders.slice(0, 6).map((reminder) => (
                      <div key={reminder.app._id} className="rounded-3xl border border-white/10 bg-slate-900/80 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-white">{reminder.app.company}</p>
                            <p className="text-sm text-slate-400">{reminder.app.role}</p>
                            <p className="mt-2 text-xs text-slate-300">Due: {formatDate(reminder.app.followUpDate)}</p>
                          </div>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              reminder.urgency === "overdue"
                                ? "bg-rose-500/20 text-rose-300"
                                : reminder.urgency === "today"
                                ? "bg-amber-500/20 text-amber-300"
                                : "bg-sky-500/20 text-sky-300"
                            }`}
                          >
                            {reminder.urgency === "overdue"
                              ? `${Math.abs(reminder.daysUntilDue)} day(s) overdue`
                              : reminder.urgency === "today"
                              ? "Follow-up today"
                              : `In ${reminder.daysUntilDue} day(s)`}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleEditApplication(reminder.app)}
                            className="rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-slate-950 transition hover:bg-amber-400"
                          >
                            Open
                          </button>
                          <button
                            type="button"
                            onClick={() => dismissReminder(reminder.app._id)}
                            className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>
          </div>

          <div className="px-6 pb-8 sm:px-8">
            <div className="mb-6 flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-slate-950/90 p-6 shadow-[0_18px_120px_-40px_rgba(15,23,42,0.7)]">
              <div>
                <p className="text-sm text-slate-400">Status board</p>
                <h2 className="mt-2 text-3xl font-semibold text-white">Kanban flow</h2>
              </div>
              <p className="text-sm leading-6 text-slate-400">Drag cards across stages and instantly save the new status. Keep your job search organized and actionable.</p>
            </div>

            {hasNoApplications && (
              <div className="mb-4 rounded-3xl border border-dashed border-sky-500/40 bg-sky-500/10 p-5">
                <p className="text-sm text-sky-700 dark:text-sky-200">
                  No applications added yet. Use the form on the right to add your first application and start your pipeline.
                </p>
              </div>
            )}

            {hasNoFilteredResults && (
              <div className="mb-4 rounded-3xl border border-dashed border-amber-500/40 bg-amber-500/10 p-5">
                <p className="text-sm text-amber-700 dark:text-amber-200">
                  No results match your current search/filter. Try clearing search or selecting "All statuses".
                </p>
              </div>
            )}

            <div className="grid gap-4 xl:grid-cols-5">
              {statusColumns.map((column) => (
                <div
                  key={column.key}
                  onDragOver={(e) => handleDragOverColumn(e, column.key)}
                  onDrop={(e) => handleDropOnColumn(e, column.key)}
                  onDragLeave={() => {
                    if (dragOverColumn === column.key) {
                      setDragOverColumn(null);
                    }
                  }}
                  className={`rounded-[1.75rem] border p-4 min-h-[320px] transition ${
                    dragOverColumn === column.key
                      ? "bg-slate-900 border-sky-500/40 shadow-[0_0_0_1px_rgba(56,189,248,0.45)]"
                      : "bg-slate-950 border-slate-800"
                  }`}
                >
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <h3 className="text-base font-semibold text-slate-100">{column.label}</h3>
                    <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
                      {groupedApplications[column.key]?.length || 0}
                    </span>
                  </div>

                  <div className="space-y-4">
                    {groupedApplications[column.key]?.length === 0 ? (
                      <p className="text-sm text-slate-500">No applications yet.</p>
                    ) : (
                      groupedApplications[column.key].map((app) => (
                        <div
                          key={app._id}
                          draggable={updatingStatusId !== app._id}
                          onDragStart={(e) => handleDragStart(e, app)}
                          onDragEnd={handleDragEnd}
                          className={`rounded-[1.75rem] border border-slate-800 bg-slate-900 p-4 shadow-sm transition ${
                            updatingStatusId === app._id
                              ? "opacity-60 cursor-not-allowed"
                              : "cursor-grab hover:-translate-y-0.5"
                          } ${draggedApp?._id === app._id ? "opacity-60" : ""}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h4 className="font-semibold text-slate-100">{app.company}</h4>
                              <p className="mt-1 text-sm text-slate-400">{app.role}</p>
                            </div>
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              statusTagStyles[normalizeStatus(app.status)] || "bg-slate-700 text-slate-100"
                            }`}>
                              {app.status}
                            </span>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-400">
                            {app.salary !== undefined && <span>Salary: ₹{app.salary}</span>}
                            {app.followUpDate && <span>Follow-up: {formatDate(app.followUpDate)}</span>}
                          </div>

                          {app.notes && (
                            <p className="mt-3 text-sm leading-6 text-slate-400 whitespace-pre-line">
                              {app.notes}
                            </p>
                          )}

                          {app.jdLink && (
                            <a
                              href={app.jdLink}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-3 inline-block text-sm text-sky-400 hover:text-sky-300"
                            >
                              View JD Link
                            </a>
                          )}

                          <div className="mt-4 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleEditApplication(app)}
                              className="rounded-full bg-amber-500 px-3 py-1 text-sm font-semibold text-slate-950 shadow-sm shadow-amber-500/20 transition duration-200 hover:bg-amber-400 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-slate-950"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteApplication(app._id)}
                              className="rounded-full bg-rose-500 px-3 py-1 text-sm font-semibold text-white shadow-sm shadow-rose-500/15 transition duration-200 hover:bg-rose-400 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-rose-400 focus:ring-offset-2 focus:ring-offset-slate-950"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
