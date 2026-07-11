import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";

/**
 * Reverse a posted journal entry.  The body is optional; if supplied the
 * reason is appended to the new reversal entry's description so it shows
 * up in the audit trail.
 */
export class ReverseJournalDto {
  @ApiPropertyOptional({ description: "Reason for reversal (audit log)" })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
