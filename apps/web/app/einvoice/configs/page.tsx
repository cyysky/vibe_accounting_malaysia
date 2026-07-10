'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, FileCheck2 } from 'lucide-react';
import { api, type EinvoiceConfig } from '../../../lib/api';
import { Button } from '../../../components/ui/Button';
import { DataTable } from '../../../components/ui/DataTable';
import { Modal } from '../../../components/ui/Modal';
import { Field, Input, Select, Badge } from '../../../components/ui/Form';
import { PageHeader } from '../../../components/ui/PageHeader';

const schema = z.object({
  environment: z.enum(['SANDBOX', 'PRODUCTION']),
  clientId: z.string().min(1, 'Required'),
  clientSecret: z.string().min(1, 'Required'),
  taxpayerTin: z.string().min(1, 'Required'),
  taxpayerBrn: z.string().optional(),
  taxpayerName: z.string().optional(),
  certPath: z.string().optional(),
});
type Form = z.infer<typeof schema>;

export default function EinvoiceConfigPage() {
  const qc = useQueryClient();
  const [show, setShow] = useState(false);

  const configs = useQuery({ queryKey: ['einvoice-configs'], queryFn: () => api.einvoiceConfigs() });

  const upsert = useMutation({
    mutationFn: (data: Form) => api.upsertEinvoiceConfig(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['einvoice-configs'] });
      setShow(false);
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteEinvoiceConfig(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['einvoice-configs'] }),
  });

  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { environment: 'SANDBOX', clientId: '', clientSecret: '', taxpayerTin: '' },
  });

  function openCreate() {
    form.reset({ environment: 'SANDBOX', clientId: '', clientSecret: '', taxpayerTin: '' });
    setShow(true);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="MyInvois Configuration"
        description="LHDNM e-Invoice API credentials. Get them from the MyInvois developer portal."
        actions={
          <>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> New Configuration
        </Button>
          </>
        }
      />

      <div className="rounded-md border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
        <div className="flex items-center gap-2 font-semibold">
          <FileCheck2 className="h-4 w-4" /> How to obtain MyInvois API credentials
        </div>
        <ol className="ml-6 mt-2 list-decimal space-y-1 text-xs">
          <li>Register your business at the MyInvois developer portal (<a href="https://sdk.myinvois.hasil.gov.my/" className="underline">sdk.myinvois.hasil.gov.my</a>).</li>
          <li>Create an app for the SANDBOX environment first to validate your integration.</li>
          <li>Upload an X.509 certificate with the <em>Document Signing</em> Extended Key Usage.</li>
          <li>Copy the Client ID and Client Secret below.</li>
        </ol>
      </div>

      <DataTable
        data={configs.data ?? []}
        loading={configs.isLoading}
        rowKey={(c) => c.id}
        empty="No MyInvois configurations yet — create one to start submitting e-invoices."
        columns={[
          {
            key: 'env',
            header: 'Environment',
            render: (c: EinvoiceConfig) => <Badge tone={c.environment === 'PRODUCTION' ? 'danger' : 'info'}>{c.environment}</Badge>,
          },
          { key: 'client', header: 'Client ID', render: (c) => <span className="font-mono text-xs">{c.clientId}</span> },
          { key: 'tin', header: 'Taxpayer TIN', render: (c) => c.taxpayerTin },
          { key: 'brn', header: 'BRN', render: (c) => c.taxpayerBrn ?? '—' },
          { key: 'cert', header: 'Cert Path', render: (c) => c.certPath ?? '—' },
          {
            key: 'active',
            header: 'Status',
            render: (c) => <Badge tone={c.active ? 'success' : 'default'}>{c.active ? 'Active' : 'Inactive'}</Badge>,
          },
          {
            key: 'actions',
            header: '',
            align: 'right',
            render: (c) => (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => confirm(`Delete ${c.environment} config?`) && remove.mutate(c.id)}
              >
                <Trash2 className="h-4 w-4 text-rose-600" />
              </Button>
            ),
          },
        ]}
      />

      <Modal
        open={show}
        onClose={() => setShow(false)}
        title="MyInvois Configuration"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShow(false)}>
              Cancel
            </Button>
            <Button loading={upsert.isPending} onClick={form.handleSubmit((d) => upsert.mutate(d))}>
              Save
            </Button>
          </>
        }
      >
        <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={form.handleSubmit((d) => upsert.mutate(d))}>
          <Field label="Environment" required>
            <Select {...form.register('environment')}>
              <option value="SANDBOX">SANDBOX (preprod-api.myinvois.hasil.gov.my)</option>
              <option value="PRODUCTION">PRODUCTION (api.myinvois.hasil.gov.my)</option>
            </Select>
          </Field>
          <Field label="Client ID" required>
            <Input {...form.register('clientId')} />
          </Field>
          <Field label="Client Secret" required>
            <Input type="password" {...form.register('clientSecret')} />
          </Field>
          <Field label="Taxpayer TIN" required>
            <Input {...form.register('taxpayerTin')} placeholder="IG1234567890" />
          </Field>
          <Field label="Taxpayer BRN">
            <Input {...form.register('taxpayerBrn')} />
          </Field>
          <Field label="Taxpayer Name">
            <Input {...form.register('taxpayerName')} />
          </Field>
          <Field label="Certificate Path (.p12)" hint="Mounted inside the API container, e.g. /var/lib/vibe/certs/client.p12" className="md:col-span-2">
            <Input {...form.register('certPath')} placeholder="/var/lib/vibe/certs/client.p12" />
          </Field>
        </form>
      </Modal>
    </div>
  );
}
