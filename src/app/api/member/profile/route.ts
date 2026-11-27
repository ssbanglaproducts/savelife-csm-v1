import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { activeMemberErrorResponse, requireActiveMemberApi } from "@/lib/member-access";
import { hasLockedProfileFields } from "@/lib/profile-lock";
import { uploadedImageUrlPattern } from "@/lib/uploads";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Identity and contact details are permanently fixed at signup. The only
 * member-editable profile value is the photo; addresses and nominees have
 * their own dedicated resources.
 */
const profileSchema = z.object({
  profileImage: z.string().regex(uploadedImageUrlPattern).nullable().optional(),
});

export async function PATCH(request: Request) {
  const access = await requireActiveMemberApi();
  if (!access.ok) return activeMemberErrorResponse(access);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (hasLockedProfileFields(body)) {
    return NextResponse.json({ error: "PROFILE_FIELDS_LOCKED" }, { status: 403 });
  }

  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (parsed.data.profileImage === undefined) {
    return NextResponse.json({ ok: true });
  }

  try {
    await prisma.member.update({
      where: { id: access.memberId },
      data: { profileImage: parsed.data.profileImage },
    });

    revalidatePath("/[locale]/member/profile", "page");
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "PROFILE_UPDATE_FAILED" }, { status: 500 });
  }
}
