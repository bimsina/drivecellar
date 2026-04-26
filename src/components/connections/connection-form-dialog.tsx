import { useForm } from '@tanstack/react-form'
import type { ReactFormExtendedApi } from '@tanstack/react-form'
import type { AnyFieldApi } from '@tanstack/form-core'
import { Eye, FolderLock, HardDrive, PencilLine, ServerCog } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { z } from 'zod/v4'

import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { ColorPicker } from '#/components/ui/color-picker'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { FieldError } from '#/components/ui/field-error'
import { Input } from '#/components/ui/input'
import { IconPicker } from '#/components/ui/icon-picker'
import { Label } from '#/components/ui/label'
import { Separator } from '#/components/ui/separator'
import { cn } from '#/lib/utils'
import { Switch } from '#/components/ui/switch'
import {
  connectionMetadataSchema,
  permissionAccessSchema,
  connectionTypeSchema,
  createConnectionInputSchema,
  updateConnectionInputSchema,
} from '#/lib/connections.ts'
import { colorKeySchema, iconValueSchema } from '#/lib/tags.ts'
import type {
  ConnectionConfig,
  CreateConnectionInput,
  ConnectionListItem,
  TestConnectionConfigResult,
  UpdateConnectionInput,
} from '#/lib/connections.ts'

type ConnectionFormDialogProps = {
  mode: 'create' | 'edit'
  open: boolean
  onOpenChange: (open: boolean) => void
  connection?: ConnectionListItem | null
  /** When set, create flow runs this before saving; on failure the drive is not created. */
  testBeforeCreate?: (
    config: ConnectionConfig,
  ) => Promise<TestConnectionConfigResult>
  ensureLocalPathBeforeCreate?: (basePath: string) => Promise<void>
  onSubmit: (
    input: CreateConnectionInput | UpdateConnectionInput,
  ) => Promise<void>
}

type LocalFormConfig = {
  type: 'local'
  basePath: string
}

type S3FormConfig = {
  type: 's3'
  endpoint: string
  region: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  pathStyle: boolean
  prefix: string
  hasStoredSecret: boolean
}

type ConnectionFormValues = {
  id: string
  name: string
  description: string
  defaultAccess: 'editor' | 'viewer' | 'none'
  color: string | null
  icon: string | null
  config: LocalFormConfig | S3FormConfig
}

type ConnectionFormApi = ReactFormExtendedApi<
  ConnectionFormValues,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any
>

type StringFieldValidator = (props: {
  value: string
  fieldApi: AnyFieldApi
}) => string | undefined

const connectionFormMetadataSchema = z.object({
  id: z.string(),
  name: connectionMetadataSchema.shape.name,
  description: z
    .string()
    .max(500, 'Description must be 500 characters or fewer.'),
  defaultAccess: permissionAccessSchema,
  color: colorKeySchema.nullable(),
  icon: iconValueSchema.nullable(),
})

const createLocalFormConfigSchema = z.object({
  type: z.literal('local'),
  basePath: z.string().trim().min(1, 'Base path is required.'),
})

const createS3FormConfigSchema = z.object({
  type: z.literal('s3'),
  endpoint: z.string().trim().min(1, 'Endpoint is required.'),
  region: z.string(),
  bucket: z.string().trim().min(1, 'Bucket is required.'),
  accessKeyId: z.string().trim().min(1, 'Access key ID is required.'),
  secretAccessKey: z.string().trim().min(1, 'Secret access key is required.'),
  pathStyle: z.boolean(),
  prefix: z.string(),
  hasStoredSecret: z.boolean().default(false),
})

const updateS3FormConfigSchema = createS3FormConfigSchema.extend({
  secretAccessKey: z.string(),
})

const connectionStepOneSchema = connectionFormMetadataSchema.extend({
  config: z.object({
    type: connectionTypeSchema,
  }),
})

const createConnectionFormSchema = connectionFormMetadataSchema.extend({
  config: z.discriminatedUnion('type', [
    createLocalFormConfigSchema,
    createS3FormConfigSchema,
  ]),
})

const updateConnectionFormSchema = connectionFormMetadataSchema.extend({
  id: z.string().min(1),
  config: z.discriminatedUnion('type', [
    createLocalFormConfigSchema,
    updateS3FormConfigSchema,
  ]),
})

function getSchemaError(
  schema: z.ZodTypeAny,
  value: unknown,
): string | undefined {
  const result = schema.safeParse(value)
  return result.success ? undefined : result.error.issues[0]?.message
}

function getDefaultLocalConfig(): LocalFormConfig {
  return {
    type: 'local',
    basePath: '',
  }
}

function getDefaultS3Config(): S3FormConfig {
  return {
    type: 's3',
    endpoint: '',
    region: '',
    bucket: '',
    accessKeyId: '',
    secretAccessKey: '',
    pathStyle: false,
    prefix: '',
    hasStoredSecret: false,
  }
}

function getConfigValuesForType(
  type: ConnectionFormValues['config']['type'],
  connection?: ConnectionListItem | null,
): ConnectionFormValues['config'] {
  if (type === 's3') {
    if (connection?.config.type === 's3') {
      return {
        type: 's3',
        endpoint: connection.config.endpoint,
        region: connection.config.region ?? '',
        bucket: connection.config.bucket,
        accessKeyId: connection.config.accessKeyId,
        secretAccessKey: '',
        pathStyle: connection.config.pathStyle,
        prefix: connection.config.prefix ?? '',
        hasStoredSecret: connection.config.hasSecretAccessKey,
      }
    }

    return getDefaultS3Config()
  }

  if (connection?.config.type === 'local') {
    return {
      type: 'local',
      basePath: connection.config.basePath,
    }
  }

  return getDefaultLocalConfig()
}

function getDefaultFormValues(): ConnectionFormValues {
  return {
    id: '',
    name: '',
    description: '',
    defaultAccess: 'editor',
    color: null,
    icon: null,
    config: getDefaultLocalConfig(),
  }
}

function getFormValuesFromConnection(
  connection: ConnectionListItem | null | undefined,
): ConnectionFormValues {
  if (!connection) {
    return getDefaultFormValues()
  }

  return {
    id: connection.id,
    name: connection.name,
    description: connection.description ?? '',
    defaultAccess: connection.defaultAccess,
    color: connection.color,
    icon: connection.icon,
    config: getConfigValuesForType(connection.config.type, connection),
  }
}

function getNormalizedOptionalValue(value: string) {
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

function toCreateInput(values: ConnectionFormValues): CreateConnectionInput {
  if (values.config.type === 's3') {
    return {
      name: values.name,
      description: values.description,
      defaultAccess: values.defaultAccess,
      color: values.color,
      icon: values.icon,
      config: {
        type: 's3',
        endpoint: values.config.endpoint,
        region: getNormalizedOptionalValue(values.config.region),
        bucket: values.config.bucket,
        accessKeyId: values.config.accessKeyId,
        secretAccessKey: values.config.secretAccessKey,
        pathStyle: values.config.pathStyle,
        prefix: getNormalizedOptionalValue(values.config.prefix),
      },
    }
  }

  return {
    name: values.name,
    description: values.description,
    defaultAccess: values.defaultAccess,
    color: values.color,
    icon: values.icon,
    config: {
      type: 'local',
      basePath: values.config.basePath,
    },
  }
}

function toUpdateInput(values: ConnectionFormValues): UpdateConnectionInput {
  if (values.config.type === 's3') {
    return {
      id: values.id,
      name: values.name,
      description: values.description,
      defaultAccess: values.defaultAccess,
      color: values.color,
      icon: values.icon,
      config: {
        type: 's3',
        endpoint: values.config.endpoint,
        region: getNormalizedOptionalValue(values.config.region),
        bucket: values.config.bucket,
        accessKeyId: values.config.accessKeyId,
        secretAccessKey: getNormalizedOptionalValue(
          values.config.secretAccessKey,
        ),
        pathStyle: values.config.pathStyle,
        prefix: getNormalizedOptionalValue(values.config.prefix),
      },
    }
  }

  return {
    id: values.id,
    name: values.name,
    description: values.description,
    defaultAccess: values.defaultAccess,
    color: values.color,
    icon: values.icon,
    config: {
      type: 'local',
      basePath: values.config.basePath,
    },
  }
}

function getConnectionTypeLabel(type: ConnectionFormValues['config']['type']) {
  return type === 's3' ? 'S3 drive' : 'Local drive'
}

function getFormSchema(isEditMode: boolean) {
  return isEditMode ? updateConnectionFormSchema : createConnectionFormSchema
}

function isStepOneValid(values: ConnectionFormValues) {
  return connectionStepOneSchema.safeParse(values).success
}

function isStepTwoValid(values: ConnectionFormValues, isEditMode: boolean) {
  return getFormSchema(isEditMode).safeParse(values).success
}

function getFieldErrors(errors: readonly unknown[] | undefined) {
  return errors?.length ? errors : undefined
}

function validateConnectionName({ value }: { value: string }) {
  return getSchemaError(connectionFormMetadataSchema.shape.name, value)
}

function validateDescription({ value }: { value: string }) {
  return getSchemaError(connectionFormMetadataSchema.shape.description, value)
}

function validateConnectionType({ value }: { value: string }) {
  return getSchemaError(connectionTypeSchema, value)
}

function validateDefaultAccess({ value }: { value: string }) {
  return getSchemaError(permissionAccessSchema, value)
}

function validateBasePath({ value }: { value: string }) {
  return getSchemaError(createLocalFormConfigSchema.shape.basePath, value)
}

function validateEndpoint({ value }: { value: string }) {
  return getSchemaError(createS3FormConfigSchema.shape.endpoint, value)
}

function validateRegion({ value }: { value: string }) {
  return getSchemaError(createS3FormConfigSchema.shape.region, value)
}

function validateBucket({ value }: { value: string }) {
  return getSchemaError(createS3FormConfigSchema.shape.bucket, value)
}

function validateAccessKeyId({ value }: { value: string }) {
  return getSchemaError(createS3FormConfigSchema.shape.accessKeyId, value)
}

function validatePrefix({ value }: { value: string }) {
  return getSchemaError(createS3FormConfigSchema.shape.prefix, value)
}

function validateSecretAccessKey({
  value,
  fieldApi,
}: {
  value: string
  fieldApi: AnyFieldApi
}) {
  const values = fieldApi.form.state.values as ConnectionFormValues

  if (
    values.config.type === 's3' &&
    values.config.hasStoredSecret &&
    value.trim().length === 0
  ) {
    return undefined
  }

  return getSchemaError(createS3FormConfigSchema.shape.secretAccessKey, value)
}

type OptionCard<TValue extends string> = {
  value: TValue
  title: string
  description: string
  icon: ReactNode
}

const connectionTypeOptions: OptionCard<'local' | 's3'>[] = [
  {
    value: 'local',
    title: 'Local filesystem',
    description: 'Use a folder mounted on this server.',
    icon: <HardDrive className="size-4" />,
  },
  {
    value: 's3',
    title: 'S3-compatible',
    description: 'Connect a bucket from AWS, MinIO, R2, and more.',
    icon: <ServerCog className="size-4" />,
  },
]

const defaultAccessOptions: OptionCard<'editor' | 'viewer' | 'none'>[] = [
  {
    value: 'editor',
    title: 'Editor',
    description: 'Members can upload, rename, and delete.',
    icon: <PencilLine className="size-4" />,
  },
  {
    value: 'viewer',
    title: 'Viewer',
    description: 'Members can browse and download only.',
    icon: <Eye className="size-4" />,
  },
  {
    value: 'none',
    title: 'Private',
    description: 'Require explicit access grants.',
    icon: <FolderLock className="size-4" />,
  },
]

function TextField({
  form,
  name,
  label,
  placeholder,
  validate,
  autoFocus = false,
  type,
  className,
  hint,
}: {
  form: ConnectionFormApi
  name:
    | 'name'
    | 'config.basePath'
    | 'config.endpoint'
    | 'config.region'
    | 'config.bucket'
    | 'config.accessKeyId'
    | 'config.secretAccessKey'
    | 'config.prefix'
  label: string
  placeholder?: string
  validate: StringFieldValidator
  autoFocus?: boolean
  type?: string
  className?: string
  hint?: ReactNode
}) {
  return (
    <form.Field
      name={name}
      validators={{
        onChange: validate,
        onSubmit: validate,
      }}
    >
      {(field) => (
        <div className={className ?? 'space-y-2'}>
          <Label htmlFor={field.name}>{label}</Label>
          <Input
            id={field.name}
            name={field.name}
            value={field.state.value}
            autoFocus={autoFocus}
            type={type}
            placeholder={placeholder}
            aria-invalid={field.state.meta.errors.length > 0}
            onBlur={field.handleBlur}
            onChange={(event) => field.handleChange(event.target.value)}
          />
          {hint}
          <FieldError errors={getFieldErrors(field.state.meta.errors)} />
        </div>
      )}
    </form.Field>
  )
}

function DescriptionField({ form }: { form: ConnectionFormApi }) {
  return (
    <form.Field
      name="description"
      validators={{
        onChange: validateDescription,
        onSubmit: validateDescription,
      }}
    >
      {(field) => (
        <div className="space-y-2">
          <Label htmlFor={field.name}>Description</Label>
          <Input
            id={field.name}
            name={field.name}
            value={field.state.value}
            placeholder="Shared media bucket for imports and exports."
            aria-invalid={field.state.meta.errors.length > 0}
            onBlur={field.handleBlur}
            onChange={(event) => field.handleChange(event.target.value)}
          />
          <FieldError errors={getFieldErrors(field.state.meta.errors)} />
        </div>
      )}
    </form.Field>
  )
}

function OptionGridField<TValue extends string>({
  label,
  value,
  onChange,
  options,
  hint,
  error,
  columns = 2,
}: {
  label: string
  value: TValue
  onChange: (value: TValue) => void
  options: readonly OptionCard<TValue>[]
  hint?: ReactNode
  error?: readonly unknown[]
  columns?: 2 | 3
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div
        className={cn(
          'grid gap-3',
          columns === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2',
        )}
      >
        {options.map((option) => {
          const selected = option.value === value

          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option.value)}
              className={cn(
                'border-border/70 bg-background/70 hover:border-border hover:bg-accent/40 flex min-h-24 w-full items-start gap-3 rounded-sm border p-4 text-left transition-colors',
                selected &&
                  'border-primary/60 bg-primary/8 ring-primary/20 ring-2',
              )}
            >
              <div
                className={cn(
                  'bg-muted text-muted-foreground mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-sm border',
                  selected &&
                    'bg-primary text-primary-foreground border-primary/70',
                )}
              >
                {option.icon}
              </div>
              <div className="min-w-0 space-y-1">
                <div className="font-medium">{option.title}</div>
                <p className="text-muted-foreground text-sm leading-snug">
                  {option.description}
                </p>
              </div>
            </button>
          )
        })}
      </div>
      {hint}
      <FieldError errors={getFieldErrors(error)} />
    </div>
  )
}

function ConnectionTypeField({
  form,
  connection,
  onTypeChange,
}: {
  form: ConnectionFormApi
  connection?: ConnectionListItem | null
  onTypeChange: () => void
}) {
  return (
    <form.Field
      name="config.type"
      validators={{
        onChange: validateConnectionType,
        onSubmit: validateConnectionType,
      }}
    >
      {(field) => (
        <OptionGridField
          label="Drive type"
          value={field.state.value}
          error={field.state.meta.errors}
          options={connectionTypeOptions}
          onChange={(value) => {
            field.handleChange(value)
            onTypeChange()
            form.setFieldValue(
              'config',
              getConfigValuesForType(value, connection),
            )
          }}
        />
      )}
    </form.Field>
  )
}

function DefaultAccessField({ form }: { form: ConnectionFormApi }) {
  return (
    <form.Field
      name="defaultAccess"
      validators={{
        onChange: validateDefaultAccess,
        onSubmit: validateDefaultAccess,
      }}
    >
      {(field) => (
        <OptionGridField
          label="Default member access"
          value={field.state.value}
          error={field.state.meta.errors}
          options={defaultAccessOptions}
          columns={3}
          onChange={(value) => field.handleChange(value)}
          hint={
            <p className="text-muted-foreground text-xs">
              Editors can upload, rename, and delete. Viewers can browse and
              download. Private drives require explicit grants.
            </p>
          }
        />
      )}
    </form.Field>
  )
}

function PathStyleField({ form }: { form: ConnectionFormApi }) {
  return (
    <form.Field name="config.pathStyle">
      {(field) => (
        <div className="md:col-span-2">
          <div className="border-border/70 bg-card/80 flex items-center justify-between rounded-sm border px-4 py-3">
            <div className="space-y-1">
              <Label htmlFor={field.name}>Path-style requests</Label>
              <p className="text-muted-foreground text-sm">
                Enable this for MinIO and other S3-compatible providers that
                expect path-style bucket routing.
              </p>
            </div>
            <Switch
              id={field.name}
              checked={field.state.value}
              onCheckedChange={(checked) => field.handleChange(checked)}
            />
          </div>
        </div>
      )}
    </form.Field>
  )
}

function LocalStorageFields({ form }: { form: ConnectionFormApi }) {
  return (
    <TextField
      form={form}
      name="config.basePath"
      label="Base path"
      placeholder="/Volumes/archive"
      validate={validateBasePath}
    />
  )
}

function S3StorageFields({
  form,
  hasStoredSecret,
  isEditMode,
}: {
  form: ConnectionFormApi
  hasStoredSecret: boolean
  isEditMode: boolean
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <TextField
        form={form}
        name="config.endpoint"
        label="Endpoint"
        placeholder="https://s3.amazonaws.com"
        validate={validateEndpoint}
        className="space-y-2 md:col-span-2"
      />
      <TextField
        form={form}
        name="config.bucket"
        label="Bucket"
        placeholder="drivecellar-assets"
        validate={validateBucket}
      />
      <TextField
        form={form}
        name="config.region"
        label="Region"
        placeholder="us-east-1"
        validate={validateRegion}
      />
      <TextField
        form={form}
        name="config.accessKeyId"
        label="Access key ID"
        placeholder="AKIA..."
        validate={validateAccessKeyId}
      />
      <TextField
        form={form}
        name="config.secretAccessKey"
        label="Secret access key"
        placeholder={
          isEditMode && hasStoredSecret
            ? 'Leave blank to keep the current secret'
            : 'Enter the secret access key'
        }
        validate={validateSecretAccessKey}
        type="password"
        hint={
          isEditMode && hasStoredSecret ? (
            <p className="text-muted-foreground text-xs">
              Leave blank to keep the current secret access key.
            </p>
          ) : null
        }
      />
      <TextField
        form={form}
        name="config.prefix"
        label="Prefix"
        placeholder="imports/2026"
        validate={validatePrefix}
      />
      <PathStyleField form={form} />
    </div>
  )
}

type SubmitAlert =
  | {
      kind: 'verify'
      message: string
      recovery?: {
        kind: 'create-local-path'
        basePath: string
      }
    }
  | { kind: 'save'; message: string }

export function ConnectionFormDialog({
  mode,
  open,
  onOpenChange,
  connection,
  testBeforeCreate,
  ensureLocalPathBeforeCreate,
  onSubmit,
}: ConnectionFormDialogProps) {
  const [step, setStep] = useState<1 | 2>(1)
  const [submitAlert, setSubmitAlert] = useState<SubmitAlert | null>(null)
  const [isCreatingLocalPath, setIsCreatingLocalPath] = useState(false)
  const isEditMode = mode === 'edit'
  const defaultValues = isEditMode
    ? getFormValuesFromConnection(connection)
    : getDefaultFormValues()

  async function runVerification(config: ConnectionConfig) {
    if (isEditMode || !testBeforeCreate) {
      return null
    }

    try {
      const result = await testBeforeCreate(config)
      if (result.ok) {
        return null
      }

      return {
        kind: 'verify',
        message: result.message,
        recovery:
          config.type === 'local' && result.code === 'local_path_not_found'
            ? {
                kind: 'create-local-path' as const,
                basePath: result.basePath,
              }
            : undefined,
      } satisfies SubmitAlert
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Could not verify this storage connection.'
      return {
        kind: 'verify',
        message,
      } satisfies SubmitAlert
    }
  }

  async function submitValidatedInput(
    input: CreateConnectionInput | UpdateConnectionInput,
  ) {
    try {
      await onSubmit(input)
      onOpenChange(false)
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to save the connection.'
      setSubmitAlert({ kind: 'save', message })
    }
  }

  const form = useForm({
    defaultValues,
    onSubmit: async ({ value }) => {
      setSubmitAlert(null)

      const input = isEditMode ? toUpdateInput(value) : toCreateInput(value)
      const result = isEditMode
        ? updateConnectionInputSchema.safeParse(input)
        : createConnectionInputSchema.safeParse(input)

      if (!result.success) {
        setSubmitAlert({
          kind: 'save',
          message: 'Please fix the highlighted fields and try again.',
        })
        return
      }

      if (!isEditMode && testBeforeCreate) {
        const verification = await runVerification(
          (result.data as CreateConnectionInput).config,
        )
        if (verification) {
          setSubmitAlert(verification)
          return
        }
      }

      await submitValidatedInput(result.data)
    },
    onSubmitInvalid: () => {
      setSubmitAlert({
        kind: 'save',
        message: 'Please fix the highlighted fields and try again.',
      })
    },
  })

  async function handleContinue() {
    setSubmitAlert(null)
    await form.validateAllFields('submit')

    if (isStepOneValid(form.state.values)) {
      setStep(2)
    }
  }

  async function handleCreateLocalPathAndContinue() {
    if (isEditMode || !ensureLocalPathBeforeCreate) {
      return
    }

    const parsed = createConnectionInputSchema.safeParse(
      toCreateInput(form.state.values),
    )

    if (!parsed.success || parsed.data.config.type !== 'local') {
      setSubmitAlert({
        kind: 'save',
        message: 'Please fix the highlighted fields and try again.',
      })
      return
    }

    setSubmitAlert(null)
    setIsCreatingLocalPath(true)

    try {
      await ensureLocalPathBeforeCreate(parsed.data.config.basePath)

      const verification = await runVerification(parsed.data.config)
      if (verification) {
        setSubmitAlert(verification)
        return
      }

      await submitValidatedInput(parsed.data)
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Could not create this local folder.'
      setSubmitAlert({ kind: 'verify', message })
    } finally {
      setIsCreatingLocalPath(false)
    }
  }

  const dialogTitle = isEditMode ? 'Edit storage drive' : 'Add storage drive'
  const dialogDescription = isEditMode
    ? 'Update the drive label, storage details, and credentials used by this workspace.'
    : 'Connect a local path or S3-compatible bucket so it appears as a drive in your storage library.'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-card max-h-[90vh] overflow-y-auto border sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>

        <Separator />

        <form
          className="space-y-6"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            void form.handleSubmit()
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <Badge variant="outline">Step {step} of 2</Badge>
            <form.Subscribe selector={(state) => state.values.config.type}>
              {(type) => (
                <Badge variant="secondary">
                  {getConnectionTypeLabel(type)}
                </Badge>
              )}
            </form.Subscribe>
          </div>

          {step === 1 ? (
            <section className="grid gap-4 md:grid-cols-2">
              <TextField
                form={form}
                name="name"
                label="Drive name"
                placeholder="Archive storage"
                validate={validateConnectionName}
                autoFocus
              />
              <DescriptionField form={form} />
              <div className="space-y-2 md:col-span-2">
                <Label>Color</Label>
                <form.Field name="color">
                  {(field) => (
                    <ColorPicker
                      value={field.state.value}
                      onChange={(next) => field.handleChange(next)}
                    />
                  )}
                </form.Field>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Icon</Label>
                <form.Field name="icon">
                  {(field) => (
                    <IconPicker
                      value={field.state.value}
                      onChange={(next) => field.handleChange(next)}
                    />
                  )}
                </form.Field>
              </div>
              <div className="md:col-span-2">
                <ConnectionTypeField
                  form={form}
                  connection={connection}
                  onTypeChange={() => {
                    setSubmitAlert(null)
                  }}
                />
              </div>
              <div className="md:col-span-2">
                <DefaultAccessField form={form} />
              </div>
            </section>
          ) : (
            <form.Subscribe selector={(state) => state.values.config}>
              {(config) => (
                <section
                  key={config.type}
                  className="border-border/70 bg-background/80 space-y-4 rounded-sm border p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {config.type === 's3'
                          ? 'S3 storage details'
                          : 'Local path settings'}
                      </p>
                      <p className="text-muted-foreground text-sm">
                        {config.type === 's3'
                          ? 'These values connect DriveCellar directly to your object storage endpoint.'
                          : 'Point DriveCellar at a directory accessible from the app runtime.'}
                      </p>
                    </div>
                    <Badge variant="outline">
                      {getConnectionTypeLabel(config.type)}
                    </Badge>
                  </div>

                  {config.type === 'local' ? (
                    <LocalStorageFields form={form} />
                  ) : (
                    <S3StorageFields
                      form={form}
                      hasStoredSecret={config.hasStoredSecret}
                      isEditMode={isEditMode}
                    />
                  )}
                </section>
              )}
            </form.Subscribe>
          )}

          {submitAlert ? (
            <Alert
              variant={submitAlert.kind === 'save' ? 'destructive' : 'default'}
              className={cn(
                submitAlert.kind === 'verify' &&
                  'border-amber-500/50 bg-amber-500/[0.07] text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-50',
              )}
            >
              <AlertTitle>
                {submitAlert.kind === 'verify'
                  ? 'Storage could not be reached'
                  : 'Could not save connection'}
              </AlertTitle>
              <AlertDescription
                className={
                  submitAlert.kind === 'verify'
                    ? 'text-amber-950/90 dark:text-amber-50/90'
                    : undefined
                }
              >
                <div className="space-y-3">
                  <p>{submitAlert.message}</p>
                  {submitAlert.kind === 'verify' &&
                  submitAlert.recovery?.kind === 'create-local-path' ? (
                    <div className="space-y-2">
                      <p className="text-sm">
                        Create{' '}
                        <span className="font-mono">
                          {submitAlert.recovery.basePath}
                        </span>{' '}
                        and continue adding this drive.
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          void handleCreateLocalPathAndContinue()
                        }}
                        disabled={
                          isCreatingLocalPath || !ensureLocalPathBeforeCreate
                        }
                      >
                        {isCreatingLocalPath
                          ? 'Creating folder...'
                          : 'Create folder and continue'}
                      </Button>
                    </div>
                  ) : null}
                </div>
              </AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSubmitAlert(null)
                onOpenChange(false)
              }}
            >
              Cancel
            </Button>

            {step === 1 ? (
              <form.Subscribe
                selector={(state) => ({
                  canContinue: isStepOneValid(state.values),
                  isSubmitting: state.isSubmitting,
                })}
              >
                {({ canContinue, isSubmitting }) => (
                  <Button
                    disabled={!canContinue || isSubmitting}
                    type="button"
                    onClick={() => {
                      void handleContinue()
                    }}
                  >
                    Continue
                  </Button>
                )}
              </form.Subscribe>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSubmitAlert(null)
                    setStep(1)
                  }}
                >
                  Back
                </Button>
                <form.Subscribe
                  selector={(state) => ({
                    canSubmit: isStepTwoValid(state.values, isEditMode),
                    isSubmitting: state.isSubmitting,
                  })}
                >
                  {({ canSubmit, isSubmitting }) => (
                    <Button disabled={!canSubmit || isSubmitting} type="submit">
                      {isSubmitting
                        ? isEditMode
                          ? 'Saving...'
                          : 'Adding...'
                        : isEditMode
                          ? 'Save changes'
                          : 'Add drive'}
                    </Button>
                  )}
                </form.Subscribe>
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
