import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface TenantContext {
  bId: number | null;
  entrySource: 'platform' | 'b_only' | null;
  userId: number | null;
  role: 'c_user' | 'b_tenant' | 'platform_admin' | null;
}

export const CurrentTenant = createParamDecorator(
  (data: keyof TenantContext | undefined, ctx: ExecutionContext): TenantContext | unknown => {
    const req = ctx.switchToHttp().getRequest<{ tenant?: TenantContext }>();
    const tenant = req.tenant ?? { bId: null, entrySource: null, userId: null, role: null };
    return data ? tenant[data] : tenant;
  },
);
