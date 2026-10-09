"use client";

import { ChevronDown, MapPin } from "lucide-react";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Profile } from "./api";

type Field = [label: string, value: React.ReactNode];

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function InfoCard({ title, fields }: { title: string; fields: Field[] }) {
  return (
    <section className="rounded-xl border bg-card p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      <dl className="grid gap-3 text-sm">
        {fields.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="break-words">{value || "Not provided"}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function ProfileOverview({ profile }: { profile: Profile }) {
  const [open, setOpen] = useState(false);
  const { personal, guardian, academic, branch } = profile;

  return (
    <div className="mb-6 space-y-4">
      <section className="flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-sm sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <Avatar className="size-14 shrink-0">
            {personal.photo && <AvatarImage src={personal.photo} alt="" />}
            <AvatarFallback className="bg-primary-soft text-lg font-semibold text-primary">
              {initials(personal.full_name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-lg font-semibold break-words">{personal.full_name}</p>
            <p className="text-sm text-muted-foreground">
              {academic.registration_no} · {academic.program} · Semester {academic.semester}
            </p>
          </div>
        </div>
        {branch && (
          <span className="inline-flex w-fit max-w-full items-center gap-1.5 rounded-full border border-primary/25 bg-primary-soft px-3 py-1 text-sm text-foreground">
            <MapPin className="size-4 shrink-0 text-primary" aria-hidden />
            <span className="truncate">{branch.name}</span>
          </span>
        )}
      </section>

      <Button
        variant="outline"
        className="w-full md:hidden"
        aria-expanded={open}
        aria-controls="profile-details"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Hide details" : "Show details"}
        <ChevronDown className={cn("transition-transform", open && "rotate-180")} aria-hidden />
      </Button>

      <div
        id="profile-details"
        className={cn("gap-4 md:grid md:grid-cols-3", open ? "grid" : "hidden")}
      >
        <InfoCard
          title="Personal"
          fields={[
            ["Email", personal.email],
            ["Phone", personal.phone],
            ["CNIC / B-Form", personal.cnic],
            ["Date of birth", formatDate(personal.date_of_birth)],
            ["Gender", personal.gender[0].toUpperCase() + personal.gender.slice(1)],
            ["Address", personal.address],
          ]}
        />
        <InfoCard
          title="Parent / Guardian"
          fields={[
            ["Name", guardian.guardian_name],
            ["CNIC", guardian.guardian_cnic],
            ["Occupation", guardian.guardian_occupation],
            ["Contact", guardian.guardian_contact],
            ["Emergency contact", guardian.emergency_contact],
          ]}
        />
        <InfoCard
          title="Academic"
          fields={[
            ["Registration no", academic.registration_no],
            ["Program", academic.program],
            ["Semester", academic.semester],
            ["Session", academic.session],
            ["Previous qualification", academic.previous_qualification],
            ["Previous institute", academic.previous_institute],
            ["Marks / CGPA", academic.marks_or_cgpa],
          ]}
        />
      </div>
    </div>
  );
}
