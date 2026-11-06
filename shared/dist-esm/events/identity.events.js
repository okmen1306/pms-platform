import { z } from 'zod';
export const RoleCreatedEventSchema = z.object({
    roleId: z.guid(),
    kod: z.string(),
    createdBy: z.guid(),
});
export const RoleDeletedEventSchema = z.object({
    roleId: z.guid(),
    kod: z.string(),
    deletedBy: z.guid(),
});
export const RolePermissionsUpdatedEventSchema = z.object({
    roleId: z.guid(),
    permissionKeys: z.array(z.string()),
    updatedBy: z.guid(),
});
export const UserPermissionOverriddenEventSchema = z.object({
    userId: z.guid(),
    permissionKey: z.string(),
    canView: z.boolean().nullable(),
    canEdit: z.boolean().nullable(),
    grantedBy: z.guid(),
    gerekce: z.string(),
});
export const IDENTITY_EVENTS = {
    ROLE_CREATED: 'role.created',
    ROLE_DELETED: 'role.deleted',
    ROLE_PERMISSIONS_UPDATED: 'role.permissions_updated',
    USER_PERMISSION_OVERRIDDEN: 'user.permission_overridden',
};
