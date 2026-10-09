"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm, useWatch, type FieldPath } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { FormField } from "@/components/shared/FormField";
import { LoadingButton } from "@/components/shared/LoadingButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApiError, apiFetch, applyFieldErrors } from "@/lib/api";
import { cn } from "@/lib/utils";
import { assignmentsKey, studentKey, studentsKey, type StudentCreated, type StudentDetail } from "./api";
import { ProgramField } from "./ProgramField";
import { StudentAvatar } from "./StudentAvatar";

const CNIC_RE = /^\d{5}-\d{7}-\d$/;
const PHONE_RE = /^\+?\d[\d -]{6,17}\d$/;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

const ageOn = (dob: string) => {
  const born = new Date(`${dob}T00:00:00`);
  const today = new Date();
  const beforeBirthday =
    today.getMonth() < born.getMonth() ||
    (today.getMonth() === born.getMonth() && today.getDate() < born.getDate());
  return today.getFullYear() - born.getFullYear() - (beforeBirthday ? 1 : 0);
};

const text = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(min, `${label} must be at least ${min} characters.`)
    .max(max, `${label} must be at most ${max} characters.`);
const phone = z.string().trim().regex(PHONE_RE, "Enter a valid phone number, e.g. 0300-1234567.");
const cnic = z.string().trim().regex(CNIC_RE, "Use the format 12345-1234567-1.");

const schema = z.object({
  full_name: text(3, 100, "Full name"),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  phone,
  cnic,
  date_of_birth: z
    .string()
    .min(1, "Date of birth is required.")
    .refine((v) => ageOn(v) >= 15 && ageOn(v) <= 80, "Age must be between 15 and 80 years."),
  gender: z.enum(["male", "female", "other"], { errorMap: () => ({ message: "Select a gender." }) }),
  address: text(3, 255, "Address"),
  guardian_name: text(3, 100, "Guardian name"),
  guardian_cnic: cnic,
  guardian_occupation: text(2, 100, "Occupation"),
  guardian_contact: phone,
  emergency_contact: phone,
  registration_no: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9][A-Z0-9-]{2,19}$/, "Use letters, digits and hyphens, e.g. VU-2024-0001."),
  program: z.string().min(1, "Select a program."),
  semester: z
    .string()
    .refine((v) => /^\d{1,2}$/.test(v) && +v >= 1 && +v <= 12, "Semester must be between 1 and 12."),
  session: z
    .string()
    .trim()
    .refine((v) => {
      const m = /^(\d{4})-(\d{4})$/.exec(v);
      return Boolean(m && +m[2] > +m[1]);
    }, "Use the format 2024-2028."),
  previous_qualification: text(2, 100, "Qualification"),
  previous_institute: text(2, 150, "Institute"),
  marks_or_cgpa: z
    .string()
    .trim()
    .refine(
      (v) => /^\d{1,4}(\.\d{1,2})?$/.test(v) && +v <= 1100,
      "Enter a CGPA from 0 to 4 or marks from 0 to 1100.",
    ),
});

type Values = z.infer<typeof schema>;
type Field = FieldPath<Values>;

const SECTIONS: { id: string; title: string; description: string; fields: Field[] }[] = [
  {
    id: "personal",
    title: "Personal",
    description: "Identity and contact details. The email is used to log in.",
    fields: ["full_name", "email", "phone", "cnic", "date_of_birth", "gender", "address"],
  },
  {
    id: "guardian",
    title: "Parent / Guardian",
    description: "Who to contact about the student.",
    fields: ["guardian_name", "guardian_cnic", "guardian_occupation", "guardian_contact", "emergency_contact"],
  },
  {
    id: "academic",
    title: "Academic",
    description: "Enrolment and previous education.",
    fields: [
      "registration_no",
      "program",
      "semester",
      "session",
      "previous_qualification",
      "previous_institute",
      "marks_or_cgpa",
    ],
  },
];

const EMPTY: Values = {
  full_name: "",
  email: "",
  phone: "",
  cnic: "",
  date_of_birth: "",
  gender: "" as Values["gender"],
  address: "",
  guardian_name: "",
  guardian_cnic: "",
  guardian_occupation: "",
  guardian_contact: "",
  emergency_contact: "",
  registration_no: "",
  program: "",
  semester: "",
  session: "",
  previous_qualification: "",
  previous_institute: "",
  marks_or_cgpa: "",
};

function toValues(s: StudentDetail): Values {
  return {
    ...Object.fromEntries(Object.keys(EMPTY).map((key) => [key, String(s[key as keyof StudentDetail] ?? "")])),
    gender: s.gender,
  } as Values;
}

const digits = (v: string, max: number) => v.replace(/\D/g, "").slice(0, max);

/** 12345-1234567-1 */
function maskCnic(value: string) {
  const d = digits(value, 13);
  return [d.slice(0, 5), d.slice(5, 12), d.slice(12)].filter(Boolean).join("-");
}

/** 0300-1234567; numbers starting with + are left as typed. */
function maskPhone(value: string) {
  if (value.startsWith("+")) return value.replace(/[^\d +-]/g, "").slice(0, 16);
  const d = digits(value, 11);
  return d.length > 4 ? `${d.slice(0, 4)}-${d.slice(4)}` : d;
}

const sectionOf = (field: string) => SECTIONS.findIndex((s) => s.fields.includes(field as Field));

type StudentFormProps = { student?: StudentDetail };

export function StudentForm({ student }: StudentFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: student ? toValues(student) : EMPTY,
  });
  const { control } = form;
  const [step, setStep] = useState(0);
  const [program, setProgram] = useState(student ? { id: student.program, name: student.program_name } : null);
  const [photo, setPhoto] = useState<{ file: File | null; preview: string | null }>({
    file: null,
    preview: student?.photo ?? null,
  });
  const [photoError, setPhotoError] = useState<string | null>(null);

  useEffect(() => {
    const preview = photo.preview;
    return () => {
      if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    };
  }, [photo.preview]);

  function pickPhoto(file: File | undefined) {
    if (!file) return;
    if (!PHOTO_TYPES.includes(file.type)) return setPhotoError("Photo must be a JPG, PNG or WEBP image.");
    if (file.size > MAX_PHOTO_BYTES) return setPhotoError("Photo must be 2 MB or smaller.");
    setPhotoError(null);
    setPhoto({ file, preview: URL.createObjectURL(file) });
  }

  function jumpToFirstError(fields: string[]) {
    const index = Math.min(...fields.map(sectionOf).filter((i) => i >= 0));
    if (Number.isFinite(index)) setStep(index);
  }

  async function next() {
    if (await form.trigger(SECTIONS[step].fields, { shouldFocus: true })) {
      setStep(step + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  const submit = form.handleSubmit(
    async (values) => {
      const body = new FormData();
      for (const [key, value] of Object.entries(values)) body.append(key, value);
      if (photo.file) body.append("photo", photo.file);
      else if (student?.photo && !photo.preview) body.append("photo", ""); // removed
      if (student) body.append("version", String(student.version));

      try {
        const saved = await apiFetch<StudentCreated | StudentDetail>(
          student ? `/admin/students/${student.id}/` : "/admin/students/",
          { method: student ? "PUT" : "POST", body },
        );
        queryClient.setQueryData(studentKey(saved.id), saved);
        await queryClient.invalidateQueries({ queryKey: studentsKey });
        await queryClient.invalidateQueries({ queryKey: assignmentsKey });
        toast.success(
          student ? "Student updated" : `Student created: setup email sent to ${saved.email}`,
        );
        router.push(`/admin/students/${saved.id}`);
      } catch (err) {
        if (applyFieldErrors(form.setError, err)) {
          jumpToFirstError(Object.keys((err as ApiError).fieldErrors));
          if ((err as ApiError).fieldErrors.photo) setPhotoError((err as ApiError).fieldErrors.photo);
        }
        if (student && err instanceof ApiError && err.status === 409 && !Object.keys(err.fieldErrors).length) {
          toast.error(err.message, {
            action: {
              label: "Reload",
              onClick: () => void queryClient.invalidateQueries({ queryKey: studentKey(student.id) }),
            },
          });
          return;
        }
        toast.error(err instanceof ApiError ? err.message : "Could not save the student.");
      }
    },
    (errors) => jumpToFirstError(Object.keys(errors)),
  );

  const last = SECTIONS.length - 1;
  const watchedName = useWatch({ control, name: "full_name" });

  return (
    <form onSubmit={submit} noValidate className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-8">
      <nav aria-label="Form sections" className="hidden lg:block">
        <ol className="sticky top-20 grid gap-1">
          {SECTIONS.map((section, i) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <span className="flex size-6 items-center justify-center rounded-full bg-primary-soft text-xs text-primary">
                  {i + 1}
                </span>
                {section.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="min-w-0 space-y-6">
        <MobileStepper step={step} />

        {SECTIONS.map((section, i) => (
          <section
            key={section.id}
            id={section.id}
            aria-labelledby={`${section.id}-title`}
            className={cn(
              "scroll-mt-20 rounded-xl border bg-card p-4 shadow-sm md:p-6",
              step !== i && "hidden md:block",
            )}
          >
            <header className="mb-4">
              <h2 id={`${section.id}-title`} className="text-lg font-semibold">
                {section.title}
              </h2>
              <p className="text-sm text-muted-foreground">{section.description}</p>
            </header>
            <div className="grid gap-4 md:grid-cols-2">
              {section.id === "personal" && (
                <>
                  <PhotoPicker
                    name={watchedName}
                    preview={photo.preview}
                    error={photoError}
                    onPick={pickPhoto}
                    onRemove={() => {
                      setPhoto({ file: null, preview: null });
                      setPhotoError(null);
                    }}
                  />
                  <FormField control={control} name="full_name" label="Full name" required>
                    {(field) => <Input {...field} autoComplete="off" />}
                  </FormField>
                  <FormField control={control} name="email" label="Email" required>
                    {(field) => <Input {...field} type="email" inputMode="email" autoComplete="off" />}
                  </FormField>
                  <FormField control={control} name="phone" label="Phone" required>
                    {(field) => (
                      <Input
                        {...field}
                        type="tel"
                        inputMode="tel"
                        placeholder="0300-1234567"
                        onChange={(e) => field.onChange(maskPhone(e.target.value))}
                      />
                    )}
                  </FormField>
                  <FormField control={control} name="cnic" label="CNIC / B-Form" required>
                    {(field) => (
                      <Input
                        {...field}
                        inputMode="numeric"
                        placeholder="12345-1234567-1"
                        onChange={(e) => field.onChange(maskCnic(e.target.value))}
                      />
                    )}
                  </FormField>
                  <FormField control={control} name="date_of_birth" label="Date of birth" required>
                    {(field) => <Input {...field} type="date" />}
                  </FormField>
                  <FormField control={control} name="gender" label="Gender" required>
                    {({ value, onChange, ref, ...field }) => (
                      <Select value={value || undefined} onValueChange={onChange}>
                        <SelectTrigger ref={ref} {...field} className="w-full">
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </FormField>
                  <FormField control={control} name="address" label="Address" required className="md:col-span-2">
                    {(field) => <Input {...field} autoComplete="off" />}
                  </FormField>
                </>
              )}

              {section.id === "guardian" && (
                <>
                  <FormField control={control} name="guardian_name" label="Guardian name" required>
                    {(field) => <Input {...field} autoComplete="off" />}
                  </FormField>
                  <FormField control={control} name="guardian_cnic" label="Guardian CNIC" required>
                    {(field) => (
                      <Input
                        {...field}
                        inputMode="numeric"
                        placeholder="12345-1234567-1"
                        onChange={(e) => field.onChange(maskCnic(e.target.value))}
                      />
                    )}
                  </FormField>
                  <FormField control={control} name="guardian_occupation" label="Occupation" required>
                    {(field) => <Input {...field} autoComplete="off" />}
                  </FormField>
                  <FormField control={control} name="guardian_contact" label="Guardian contact" required>
                    {(field) => (
                      <Input
                        {...field}
                        type="tel"
                        inputMode="tel"
                        placeholder="0300-1234567"
                        onChange={(e) => field.onChange(maskPhone(e.target.value))}
                      />
                    )}
                  </FormField>
                  <FormField control={control} name="emergency_contact" label="Emergency contact" required>
                    {(field) => (
                      <Input
                        {...field}
                        type="tel"
                        inputMode="tel"
                        placeholder="0300-1234567"
                        onChange={(e) => field.onChange(maskPhone(e.target.value))}
                      />
                    )}
                  </FormField>
                </>
              )}

              {section.id === "academic" && (
                <>
                  <FormField control={control} name="registration_no" label="Registration no." required>
                    {(field) => (
                      <Input
                        {...field}
                        placeholder="VU-2024-0001"
                        autoComplete="off"
                        autoCapitalize="characters"
                        className="uppercase"
                      />
                    )}
                  </FormField>
                  <FormField control={control} name="program" label="Program" required>
                    {(field) => (
                      <ProgramField
                        id={field.id}
                        value={program}
                        invalid={field["aria-invalid"]}
                        describedBy={field["aria-describedby"]}
                        onChange={(p) => {
                          setProgram({ id: p.id, name: p.name });
                          field.onChange(p.id);
                        }}
                      />
                    )}
                  </FormField>
                  <FormField control={control} name="semester" label="Semester" required>
                    {(field) => <Input {...field} inputMode="numeric" maxLength={2} placeholder="1" />}
                  </FormField>
                  <FormField control={control} name="session" label="Session" required>
                    {(field) => <Input {...field} inputMode="numeric" maxLength={9} placeholder="2024-2028" />}
                  </FormField>
                  <FormField control={control} name="previous_qualification" label="Previous qualification" required>
                    {(field) => <Input {...field} placeholder="FSc Pre-Engineering" autoComplete="off" />}
                  </FormField>
                  <FormField control={control} name="previous_institute" label="Previous institute" required>
                    {(field) => <Input {...field} autoComplete="off" />}
                  </FormField>
                  <FormField
                    control={control}
                    name="marks_or_cgpa"
                    label="Marks / CGPA"
                    description="CGPA (0 to 4) or marks (0 to 1100)."
                    required
                  >
                    {(field) => <Input {...field} inputMode="decimal" placeholder="3.45" />}
                  </FormField>
                </>
              )}
            </div>
          </section>
        ))}

        <div className="sticky bottom-0 z-10 -mx-4 flex gap-2 border-t bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur md:static md:mx-0 md:justify-end md:border-0 md:bg-transparent md:p-0 [&>*]:flex-1 md:[&>*]:flex-none">
          {step > 0 ? (
            <Button type="button" variant="outline" className="md:hidden" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          ) : (
            <Button asChild variant="outline" className="md:hidden">
              <Link href={student ? `/admin/students/${student.id}` : "/admin/students"}>Cancel</Link>
            </Button>
          )}
          <Button asChild variant="outline" className="hidden md:inline-flex">
            <Link href={student ? `/admin/students/${student.id}` : "/admin/students"}>Cancel</Link>
          </Button>
          {step < last && (
            <Button type="button" className="md:hidden" onClick={() => void next()}>
              Next
            </Button>
          )}
          <LoadingButton
            type="submit"
            loading={form.formState.isSubmitting}
            className={cn(step < last && "hidden md:inline-flex")}
          >
            {student ? "Save changes" : "Create student"}
          </LoadingButton>
        </div>
      </div>
    </form>
  );
}

function MobileStepper({ step }: { step: number }) {
  return (
    <div className="md:hidden">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        Step {step + 1} of {SECTIONS.length}: <span className="font-medium text-foreground">{SECTIONS[step].title}</span>
      </p>
      <ol className="mt-2 grid grid-cols-3 gap-2" aria-hidden>
        {SECTIONS.map((section, i) => (
          <li key={section.id} className={cn("h-1.5 rounded-full", i <= step ? "bg-primary" : "bg-muted")} />
        ))}
      </ol>
    </div>
  );
}

type PhotoPickerProps = {
  name: string;
  preview: string | null;
  error: string | null;
  onPick: (file: File | undefined) => void;
  onRemove: () => void;
};

function PhotoPicker({ name, preview, error, onPick, onRemove }: PhotoPickerProps) {
  return (
    <div className="flex items-center gap-4 md:col-span-2">
      <StudentAvatar name={name || "?"} photo={preview} className="size-16 text-lg" />
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" asChild>
            <label className="cursor-pointer">
              <ImagePlus aria-hidden />
              {preview ? "Change photo" : "Upload photo"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(e) => {
                  onPick(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
          </Button>
          {preview && (
            <Button type="button" variant="ghost" onClick={onRemove}>
              <Trash2 aria-hidden />
              Remove
            </Button>
          )}
        </div>
        <p className={cn("text-xs", error ? "text-danger" : "text-muted-foreground")} role={error ? "alert" : undefined}>
          {error ?? "Optional. JPG, PNG or WEBP, up to 2 MB."}
        </p>
      </div>
    </div>
  );
}
