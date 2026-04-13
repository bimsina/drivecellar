export const authLocalizationOverrides = {
  ORGANIZATION: 'Team',
  ORGANIZATIONS: 'Teams',
  CREATE_ORGANIZATION: 'Create Team',
  ORGANIZATION_NAME: 'Team name',
  ORGANIZATION_NAME_PLACEHOLDER: 'DriveCellar Team',
  ORGANIZATION_NAME_DESCRIPTION: "This is your team's visible name.",
  ORGANIZATION_NAME_INSTRUCTIONS: 'Please use 32 characters at maximum.',
  ORGANIZATION_SLUG: 'Team slug',
  ORGANIZATION_SLUG_DESCRIPTION: "This is your team's URL namespace.",
  ORGANIZATION_SLUG_INSTRUCTIONS: 'Please use 48 characters at maximum.',
  ORGANIZATION_SLUG_PLACEHOLDER: 'drivecellar-team',
  CREATE_ORGANIZATION_SUCCESS: 'Team created successfully',
  ORGANIZATIONS_DESCRIPTION: 'Manage your teams and memberships.',
  ORGANIZATIONS_INSTRUCTIONS: 'Create a team to collaborate with other users.',
  LEAVE_ORGANIZATION: 'Leave Team',
  LEAVE_ORGANIZATION_CONFIRM: 'Are you sure you want to leave this team?',
  LEAVE_ORGANIZATION_SUCCESS: 'You have successfully left the team.',
  MANAGE_ORGANIZATION: 'Manage Team',
  DELETE_ORGANIZATION: 'Delete Team',
  DELETE_ORGANIZATION_DESCRIPTION:
    'Permanently remove your team and all of its contents. This action is not reversible. Please continue with caution.',
  DELETE_ORGANIZATION_SUCCESS: 'Team deleted successfully',
  DELETE_ORGANIZATION_INSTRUCTIONS: 'Enter the team slug to continue:',
  SLUG_REQUIRED: 'Team slug is required',
  YOU_ARE_NOT_ALLOWED_TO_CREATE_A_NEW_ORGANIZATION:
    'You are not allowed to create a new team',
  YOU_HAVE_REACHED_THE_MAXIMUM_NUMBER_OF_ORGANIZATIONS:
    'You have reached the maximum number of teams',
  ORGANIZATION_ALREADY_EXISTS: 'Team already exists',
  ORGANIZATION_NOT_FOUND: 'Team not found',
  USER_IS_NOT_A_MEMBER_OF_THE_ORGANIZATION: 'User is not a member of the team',
  YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_ORGANIZATION:
    'You are not allowed to update this team',
  YOU_ARE_NOT_ALLOWED_TO_DELETE_THIS_ORGANIZATION:
    'You are not allowed to delete this team',
  NO_ACTIVE_ORGANIZATION: 'No active team',
  USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION:
    'User is already a member of this team',
  YOU_CANNOT_LEAVE_THE_ORGANIZATION_AS_THE_ONLY_OWNER:
    'You cannot leave the team as the only owner',
  YOU_ARE_NOT_ALLOWED_TO_INVITE_USERS_TO_THIS_ORGANIZATION:
    'You are not allowed to invite users to this team',
  USER_IS_ALREADY_INVITED_TO_THIS_ORGANIZATION:
    'User is already invited to this team',
  INVITER_IS_NO_LONGER_A_MEMBER_OF_THE_ORGANIZATION:
    'Inviter is no longer a member of the team',
  ORGANIZATION_MEMBERSHIP_LIMIT_REACHED: 'Team membership limit reached',
} as const
