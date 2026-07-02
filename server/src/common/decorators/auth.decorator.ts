import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = 'roles';
export type Role = 'c_user' | 'b_tenant' | 'platform_admin';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
