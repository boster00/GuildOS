// ARCHIVED: Original path was base44_generated_code/Pages/IcpList.js

import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";

export default function IcpList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [deleteId, setDeleteId] = React.useState(null);

  const { data: icps = [], isLoading } = useQuery({
    queryKey: ["icps"],
    queryFn: () => base44.entities.Icp.list("-created_date"),
  });

  const { data: prompts = [] } = useQuery({
    queryKey: ["prompts"],
    queryFn: () => base44.entities.Prompt.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Icp.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["icps"] });
      toast({ title: "ICP deleted successfully" });
      setDeleteId(null);
    },
  });

  const getPromptCount = (icpId) => {
    return prompts.filter((p) => p.icpId === icpId).length;
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Ideal Customer Profiles
          </h1>
          <p className="text-gray-600 mt-2">
            Define and manage your target customer segments
          </p>
        </div>
        <Link to={createPageUrl("IcpWizard")}>
          <Button className="bg-blue-600 hover:bg-blue-700 gap-2">
            <Plus className="w-4 h-4" />
            New ICP
          </Button>
        </Link>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-center">Prompts</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array(3)
                .fill(0)
                .map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-8 mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                  </TableRow>
                ))
            ) : icps.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12">
                  <div className="text-gray-500">
                    <p className="text-lg font-medium mb-2">No ICPs yet</p>
                    <p className="text-sm mb-4">
                      Create your first ICP to get started
                    </p>
                    <Link to={createPageUrl("IcpWizard")}>
                      <Button variant="outline" className="gap-2">
                        <Plus className="w-4 h-4" />
                        Create ICP
                      </Button>
                    </Link>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              icps.map((icp) => (
                <TableRow key={icp.id} className="group">
                  <TableCell className="font-medium">{icp.name}</TableCell>
                  <TableCell className="max-w-md truncate text-gray-600">
                    {icp.shortDesc || icp.icpDesc?.substring(0, 80) || "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 text-blue-700 font-medium text-sm">
                      {getPromptCount(icp.id)}
                    </span>
                  </TableCell>
                  <TableCell className="text-gray-600">
                    {format(new Date(icp.created_date), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          navigate(createPageUrl("IcpWizard") + `?id=${icp.id}`)
                        }
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteId(icp.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete ICP?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this ICP. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate(deleteId)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}