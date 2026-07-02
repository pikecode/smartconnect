import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY, ROLES_KEY, Role } from '../decorators/auth.decorator';
import { TenantContext } from '../decorators/current-tenant.decorator';

interface JwtPayload {
  uid: number;
  role: Role;
  tenant_context: { b_id: number | null; entry_source: 'platform' | 'b_only' };
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    const req = ctx.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      tenant?: TenantContext;
    }>();

    if (isPublic) {
      // 公开端点: 仍尝试解析 token (可选登录态),不强制
      req.tenant = this.tryParse(req.headers.authorization) ?? this.emptyContext();
      return true;
    }

    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) {
      throw new UnauthorizedException({ code: 'AUTH_010', message: '未提供token' });
    }

    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException({ code: 'AUTH_011', message: 'token无效或已过期' });
    }

    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    if (requiredRoles && !requiredRoles.includes(payload.role)) {
      throw new ForbiddenException({ code: 'AUTH_012', message: '无权限' });
    }

    req.tenant = {
      bId: payload.tenant_context?.b_id ?? null,
      entrySource: payload.tenant_context?.entry_source ?? null,
      userId: payload.uid,
      role: payload.role,
    };
    return true;
  }

  private tryParse(authHeader?: string): TenantContext | null {
    if (!authHeader) return null;
    const token = authHeader.replace(/^Bearer\s+/i, '');
    try {
      const payload = this.jwtService.verify<JwtPayload>(token);
      return {
        bId: payload.tenant_context?.b_id ?? null,
        entrySource: payload.tenant_context?.entry_source ?? null,
        userId: payload.uid,
        role: payload.role,
      };
    } catch {
      return null;
    }
  }

  private emptyContext(): TenantContext {
    return { bId: null, entrySource: null, userId: null, role: null };
  }
}
