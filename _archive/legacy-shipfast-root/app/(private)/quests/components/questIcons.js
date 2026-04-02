/**
 * Maps iconName (string) to lucide-react icon component.
 * Used by QuestCard and QuestDetailsDrawer.
 */
import {
  Users,
  Share2,
  UserPlus,
  Star,
  FileText,
  CheckCircle,
  Layers,
  Download,
  Flame,
  MessageCircle,
  DollarSign,
  Award,
  Target,
  Trophy,
} from "lucide-react";

export const questIconMap = {
  Users,
  Share2,
  UserPlus,
  Star,
  FileText,
  CheckCircle,
  Layers,
  Download,
  Flame,
  MessageCircle,
  DollarSign,
  Award,
  Target,
  Trophy,
};

export function getQuestIcon(iconName) {
  return questIconMap[iconName] || Target;
}
