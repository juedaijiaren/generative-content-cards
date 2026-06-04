import { z } from 'zod';

/**
 * 设计原则：extract 是 best-effort 抽取，render 是真正的视觉发挥。
 * 这层 schema 只兜底「render 能渲」的最小骨架；具体字段形态宽容（string | object union）
 * 避免反复打补丁。
 */

const modeEnum = z.enum(['city', 'road-trip', 'multi-city']);
const looseNumber = z.union([z.number(), z.string().min(1)]);

/** 接受 string 或 { name } 形态的轻量条目 */
const labelOrObject = z.union([
  z.string().min(1),
  z
    .object({
      name: z.string().optional(),
    })
    .passthrough(),
]);

export const travelSchema = z
  .object({
    mode: modeEnum,
    destination: z.string().min(2).max(40),
    duration: z.string().min(2).max(30).optional(),
    durationDays: z.number().int().min(1).max(60).optional(),
    tagline: z.string().max(80).optional(),

    budget: z
      .object({
        total: looseNumber.optional(),
        currency: z.string().default('CNY').optional(),
        breakdown: z
          .array(
            z.object({
              item: z.string().max(20),
              amount: looseNumber.optional(),
              percent: looseNumber.optional(),
            })
          )
          .max(10)
          .optional(),
      })
      .passthrough()
      .optional(),

    styleTags: z.array(z.string().max(12)).max(10).optional(),

    transport: z
      .object({
        outbound: z
          .union([
            z.string(),
            z
              .object({
                mode: z.string().optional(),
                detail: z.string().optional(),
                duration: z.string().optional(),
              })
              .passthrough(),
          ])
          .optional(),
        inbound: z
          .union([
            z.string(),
            z
              .object({
                mode: z.string().optional(),
                detail: z.string().optional(),
                duration: z.string().optional(),
              })
              .passthrough(),
          ])
          .optional(),
        rental: z
          .union([
            z.string(),
            z
              .object({
                type: z.string().optional(),
                days: looseNumber.optional(),
                pickup: z.string().optional(),
              })
              .passthrough(),
          ])
          .optional(),
      })
      .passthrough()
      .optional(),

    hotels: z
      .array(
        z.union([
          z.string(),
          z
            .object({
              name: z.string().optional(),
              address: z.string().optional(),
              nights: looseNumber.optional(),
              pricePerNight: looseNumber.optional(),
              tag: z.string().optional(),
            })
            .passthrough(),
        ])
      )
      .max(20)
      .optional(),

    days: z
      .array(
        z
          .object({
            index: z.number().int().min(1).max(60).optional(),
            theme: z.string().max(40).optional(),
            stops: z
              .array(
                z.union([
                  z.string(),
                  z
                    .object({
                      time: z.string().optional(),
                      name: z.string().optional(),
                      type: z.string().optional(),
                      note: z.string().optional(),
                    })
                    .passthrough(),
                ])
              )
              .max(15)
              .optional(),
            drivingSegment: z
              .union([
                z.string(),
                z
                  .object({
                    from: z.string().optional(),
                    to: z.string().optional(),
                    distanceKm: looseNumber.optional(),
                    distance: looseNumber.optional(),
                    duration: z.string().optional(),
                    highlight: z.string().optional(),
                  })
                  .passthrough(),
              ])
              .optional(),
          })
          .passthrough()
      )
      .min(1)
      .max(30),

    mustEat: z.array(labelOrObject).max(15).optional(),
    mustSee: z.array(labelOrObject).max(15).optional(),

    tips: z.array(z.string()).max(20).optional(),

    useRealMap: z.boolean().optional(),
  })
  .passthrough();

export type TravelData = z.infer<typeof travelSchema>;
