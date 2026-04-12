import { useForm } from '@tanstack/react-form'
import type { ReactFormExtendedApi } from '@tanstack/react-form'
import type { AnyFieldApi } from '@tanstack/form-core'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { z } from 'zod/v4'

import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
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
import { Label } from '#/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { Separator } from '#/components/ui/separator'
import { Switch } from '#/components/ui/switch'
import { Textarea } from '#/components/ui/textarea'
import {
  connectionMetadataSchema,
  connectionTypeSchema,
  createConnectionInputSchema,
  updateConnectionInputSchema,
} from '#/lib/connections.ts'
import type {
  CreateConnectionInput,
  ConnectionListItem,
  UpdateConnectionInput,
} from '#/lib/connections.ts'

type ConnectionFormDialogProps = {
  mode: 'create' | 'edit'
  open: boolean
  onOpenChange: (open: boolean) => void
  connection?: ConnectionListItem | null
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
    config: {
      type: 'local',
      basePath: values.config.basePath,
    },
  }
}

function getConnectionTypeLabel(type: ConnectionFormValues['config']['type']) {
  return type === 's3' ? 'S3' : 'Local'
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
          <Textarea
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
        <div className="space-y-2">
          <Label htmlFor={field.name}>Connection type</Label>
          <Select
            value={field.state.value}
            onValueChange={(value: 's3' | 'local') => {
              onTypeChange()
              form.setFieldValue(
                'config',
                getConfigValuesForType(value, connection),
              )
            }}
          >
            <SelectTrigger
              id={field.name}
              className="w-full"
              aria-invalid={field.state.meta.errors.length > 0}
            >
              <SelectValue placeholder="Choose a connection type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="local">Local filesystem</SelectItem>
              <SelectItem value="s3">S3-compatible</SelectItem>
            </SelectContent>
          </Select>
          <FieldError errors={getFieldErrors(field.state.meta.errors)} />
        </div>
      )}
    </form.Field>
  )
}

function PathStyleField({ form }: { form: ConnectionFormApi }) {
  return (
    <form.Field name="config.pathStyle">
      {(field) => (
        <div className="md:col-span-2">
          <div className="border-border/70 bg-card/80 flex items-center justify-between rounded-3xl border px-4 py-3">
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

export function ConnectionFormDialog({
  mode,
  open,
  onOpenChange,
  connection,
  onSubmit,
}: ConnectionFormDialogProps) {
  const [step, setStep] = useState<1 | 2>(1)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const isEditMode = mode === 'edit'
  const defaultValues = isEditMode
    ? getFormValuesFromConnection(connection)
    : getDefaultFormValues()

  const form = useForm({
    defaultValues,
    onSubmit: async ({ value }) => {
      setSubmitError(null)

      const input = isEditMode ? toUpdateInput(value) : toCreateInput(value)
      const result = isEditMode
        ? updateConnectionInputSchema.safeParse(input)
        : createConnectionInputSchema.safeParse(input)

      if (!result.success) {
        setSubmitError('Please fix the highlighted fields and try again.')
        return
      }

      try {
        await onSubmit(result.data)
        onOpenChange(false)
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Unable to save the connection.'
        setSubmitError(message)
      }
    },
    onSubmitInvalid: () => {
      setSubmitError('Please fix the highlighted fields and try again.')
    },
  })

  async function handleContinue() {
    setSubmitError(null)
    await form.validateAllFields('submit')

    if (isStepOneValid(form.state.values)) {
      setStep(2)
    }
  }

  const dialogTitle = isEditMode ? 'Edit connection' : 'Create connection'
  const dialogDescription = isEditMode
    ? 'Update the connection metadata and storage credentials for this workspace.'
    : 'Add a storage endpoint so your team can browse and manage files from one place.'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
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
                label="Connection name"
                placeholder="Archive storage"
                validate={validateConnectionName}
                autoFocus
                className="space-y-2 md:col-span-2"
              />
              <DescriptionField form={form} />
              <ConnectionTypeField
                form={form}
                connection={connection}
                onTypeChange={() => {
                  setSubmitError(null)
                }}
              />
            </section>
          ) : (
            <form.Subscribe selector={(state) => state.values.config}>
              {(config) => (
                <section
                  key={config.type}
                  className="border-border/70 bg-background/80 space-y-4 rounded-3xl border p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {config.type === 's3'
                          ? 'S3 credentials'
                          : 'Local path settings'}
                      </p>
                      <p className="text-muted-foreground text-sm">
                        {config.type === 's3'
                          ? 'These values are used to connect to your object storage endpoint.'
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

          {submitError ? (
            <Alert variant="destructive">
              <AlertTitle>Could not save connection</AlertTitle>
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSubmitError(null)
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
                    setSubmitError(null)
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
                          : 'Creating...'
                        : isEditMode
                          ? 'Save changes'
                          : 'Create connection'}
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
