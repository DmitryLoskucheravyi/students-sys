import { type CanActivate, type ExecutionContext, Injectable, SetMetadata, createParamDecorator } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { HttpError } from '../lib.js';
import type { Role, User } from './auth.js';

const AUTH_KEY = 'access:auth';
const ROLES_KEY = 'access:roles';

/** Лише для тих, хто увійшов. Ставиться на контролер або окремий метод. */
export const Auth = () => SetMetadata(AUTH_KEY, true);
/**
 * Лише для цих ролей. Ролі контролера й методу діють разом, як два middleware поспіль:
 * людина має пройти обидві перевірки.
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/** Поточний користувач. У методах під @Auth або @Roles він завжди є. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): User => ctx.switchToHttp().getRequest<Request>().user as User);

@Injectable()
export class AccessGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const targets = [ctx.getClass(), ctx.getHandler()];
    const needsAuth = targets.some((t) => this.reflector.get<boolean>(AUTH_KEY, t));
    const roleSets = targets.map((t) => this.reflector.get<Role[] | undefined>(ROLES_KEY, t)).filter((r): r is Role[] => Boolean(r));
    if (!needsAuth && !roleSets.length) return true;
    const { user } = ctx.switchToHttp().getRequest<Request>();
    if (!user) throw new HttpError(401, 'Увійдіть в акаунт');
    if (roleSets.some((roles) => !roles.includes(user.role))) throw new HttpError(403, 'Немає доступу');
    return true;
  }
}
