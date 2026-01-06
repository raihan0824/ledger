import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { importApi } from '@/lib/api'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  X,
  Download,
} from 'lucide-react'

export default function ImportPage() {
  const queryClient = useQueryClient()
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [importResult, setImportResult] = useState(null)

  const { data: historyData } = useQuery({
    queryKey: ['import-history'],
    queryFn: () => importApi.history().then(res => res.data),
  })

  const previewMutation = useMutation({
    mutationFn: (file) => importApi.preview(file),
    onSuccess: (res) => {
      setPreview(res.data)
    },
  })

  const importMutation = useMutation({
    mutationFn: (file) => importApi.commit(file),
    onSuccess: (res) => {
      setImportResult(res.data)
      setFile(null)
      setPreview(null)
      queryClient.invalidateQueries(['transactions'])
      queryClient.invalidateQueries(['import-history'])
    },
  })

  const onDrop = useCallback((acceptedFiles) => {
    const csvFile = acceptedFiles[0]
    if (csvFile) {
      setFile(csvFile)
      setPreview(null)
      setImportResult(null)
      previewMutation.mutate(csvFile)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.csv'],
    },
    maxFiles: 1,
  })

  const handleImport = () => {
    if (file) {
      importMutation.mutate(file)
    }
  }

  const handleClear = () => {
    setFile(null)
    setPreview(null)
    setImportResult(null)
  }

  const history = historyData?.data || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Import Transactions</h1>
      </div>

      {/* Import Result */}
      {importResult && (
        <Card className="border-green-500">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <div>
                <h3 className="font-semibold text-lg">Import Successful!</h3>
                <p className="text-muted-foreground">
                  {importResult.inserted} transactions imported
                  {importResult.skipped > 0 && `, ${importResult.skipped} duplicates skipped`}
                  {importResult.errors > 0 && `, ${importResult.errors} errors`}
                </p>
              </div>
              <Button variant="outline" className="ml-auto" onClick={handleClear}>
                Import Another
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload Area */}
      {!importResult && (
        <Card>
          <CardHeader>
            <CardTitle>Upload CSV File</CardTitle>
            <CardDescription>
              Import transactions from a CSV file. Supported columns: date, amount, merchant, category, type (debit/credit)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!file ? (
              <div
                {...getRootProps()}
                className={`
                  border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
                  transition-colors hover:border-primary hover:bg-primary/5
                  ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
                `}
              >
                <input {...getInputProps()} />
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                {isDragActive ? (
                  <p className="text-lg">Drop the CSV file here...</p>
                ) : (
                  <>
                    <p className="text-lg mb-2">Drag & drop a CSV file here</p>
                    <p className="text-sm text-muted-foreground">or click to select a file</p>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="h-8 w-8 text-primary" />
                    <div>
                      <p className="font-medium">{file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={handleClear}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {previewMutation.isPending && (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    <span className="ml-3">Parsing CSV...</span>
                  </div>
                )}

                {preview && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 text-sm">
                      <Badge variant="secondary">
                        {preview.totalRows} rows found
                      </Badge>
                      {preview.totalErrors > 0 && (
                        <Badge variant="destructive">
                          {preview.totalErrors} errors
                        </Badge>
                      )}
                    </div>

                    {/* Preview Table */}
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Merchant</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {preview.preview.map((row, index) => (
                            <TableRow key={index}>
                              <TableCell>{formatDateTime(row.datetime_iso)}</TableCell>
                              <TableCell>
                                <Badge variant={row.kind === 'credit' ? 'success' : 'destructive'}>
                                  {row.kind}
                                </Badge>
                              </TableCell>
                              <TableCell>{row.merchant || '-'}</TableCell>
                              <TableCell>{row.category_code}</TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(row.amount_rp)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {preview.totalRows > 10 && (
                      <p className="text-sm text-muted-foreground text-center">
                        Showing first 10 of {preview.totalRows} rows
                      </p>
                    )}

                    {/* Errors */}
                    {preview.errors.length > 0 && (
                      <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg">
                        <h4 className="font-medium text-red-600 mb-2 flex items-center gap-2">
                          <AlertCircle className="h-4 w-4" />
                          Parsing Errors
                        </h4>
                        <ul className="text-sm text-red-600 space-y-1">
                          {preview.errors.map((err, index) => (
                            <li key={index}>Row {err.row}: {err.error}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Import Button */}
                    <div className="flex justify-end gap-3">
                      <Button variant="outline" onClick={handleClear}>
                        Cancel
                      </Button>
                      <Button
                        onClick={handleImport}
                        disabled={importMutation.isPending || preview.totalRows === 0}
                      >
                        {importMutation.isPending ? 'Importing...' : `Import ${preview.totalRows} Transactions`}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* CSV Format Guide */}
      <Card>
        <CardHeader>
          <CardTitle>CSV Format Guide</CardTitle>
          <CardDescription>
            Your CSV file should include these columns (case-insensitive)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Column Name</TableHead>
                  <TableHead>Required</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Example</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-mono">date / datetime / tanggal</TableCell>
                  <TableCell><Badge>Required</Badge></TableCell>
                  <TableCell>Transaction date</TableCell>
                  <TableCell className="font-mono">2024-01-15 or 15/01/2024</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono">amount / nominal / jumlah</TableCell>
                  <TableCell><Badge>Required</Badge></TableCell>
                  <TableCell>Transaction amount</TableCell>
                  <TableCell className="font-mono">150000</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono">merchant / description / keterangan</TableCell>
                  <TableCell><Badge variant="outline">Optional</Badge></TableCell>
                  <TableCell>Merchant or description</TableCell>
                  <TableCell className="font-mono">Grocery Store</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono">kind / type / jenis</TableCell>
                  <TableCell><Badge variant="outline">Optional</Badge></TableCell>
                  <TableCell>debit (expense) or credit (income)</TableCell>
                  <TableCell className="font-mono">debit</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono">category / kategori</TableCell>
                  <TableCell><Badge variant="outline">Optional</Badge></TableCell>
                  <TableCell>Category code</TableCell>
                  <TableCell className="font-mono">food</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono">channel / bank</TableCell>
                  <TableCell><Badge variant="outline">Optional</Badge></TableCell>
                  <TableCell>Payment channel</TableCell>
                  <TableCell className="font-mono">BCA</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Import History */}
      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Import History</CardTitle>
            <CardDescription>
              Previously imported files
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Filename</TableHead>
                  <TableHead>Rows</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((batch) => (
                  <TableRow key={batch.id}>
                    <TableCell>{formatDateTime(batch.created_at)}</TableCell>
                    <TableCell className="font-mono">{batch.filename}</TableCell>
                    <TableCell>{batch.row_count}</TableCell>
                    <TableCell>
                      <Badge variant={batch.status === 'completed' ? 'success' : 'destructive'}>
                        {batch.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
