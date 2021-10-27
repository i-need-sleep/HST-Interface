import torch
from torch import nn
from torch.nn.utils.rnn import pack_padded_sequence
from torch.distributions import Normal
from torch.distributions.kl import kl_divergence
import random
import numpy as np
import format_convert as fct
import pretty_midi


class PolyphonicVAE(nn.Module):

    def count_params(self):
        return sum(p.numel() for p in self.parameters() if p.requires_grad)

    def inference_encode(self, pr, output_z=True, sample=False):
        raise NotImplementedError

    def inference_decode(self, z, other_inputs=None):
        raise NotImplementedError

    def inference_recon(self, pr, sample=False):
        z = self.inference_encode(pr, True, sample)
        pr = self.inference_decode(z)
        return pr

    def interp(self, z1, z2, num_interp=10):
        def interp_path(z1, z2, interpolation_count=10):
            result_shape = z1.shape
            z1 = z1.reshape(-1)
            z2 = z2.reshape(-1)

            # def slerp(p0, p1, t):
            #     omega = np.arccos(
            #         np.dot(p0 / np.linalg.norm(p0), p1 / np.linalg.norm(p1)))
            #     so = np.sin(omega)
            #     return np.sin((1.0 - t) * omega) / so * p0 + np.sin(
            #         t * omega) / so * p1

            def slerp2(p0, p1, t):
                omega = np.arccos(
                    np.dot(p0 / np.linalg.norm(p0), p1 / np.linalg.norm(p1)))
                so = np.sin(omega)
                return np.sin((1.0 - t) * omega)[:, None] / so * p0[
                    None] + np.sin(
                    t * omega)[:, None] / so * p1[None]

            percentages = np.linspace(0.0, 1.0, interpolation_count)

            normalized_z1 = z1 / np.linalg.norm(z1)
            normalized_z2 = z2 / np.linalg.norm(z2)
            dirs = slerp2(normalized_z1, normalized_z2, percentages)
            length = np.linspace(np.log(np.linalg.norm(z1)),
                                 np.log(np.linalg.norm(z2)),
                                 interpolation_count)
            return (dirs * np.exp(length[:, None])).reshape(
                [interpolation_count] + list(result_shape))

        z1 = z1.numpy()
        z2 = z2.numpy()
        zs = np.array([interp_path(i, j, num_interp) for i, j in zip(z1, z2)])
        zs = torch.from_numpy(zs).float()
        zs = zs.view(-1, 512)
        prs = self.inference_decode(zs).reshape([-1, num_interp, 32, 128])
        return prs

    @staticmethod
    def pr_to_pr_matrix(pr, one_hot=False):
        if not one_hot:
            onset_data = pr[:, :] == 2
            sustain_data = pr[:, :] == 1
            silence_data = pr[:, :] == 0
            pr = np.stack([onset_data, sustain_data, silence_data],
                          axis=2).astype(bool)
        pr_matrix = fct.piano_roll_to_prmat(pr)
        return pr_matrix

    @staticmethod
    def pr_to_notes(pr, bpm=80, start=0., one_hot=False):
        pr_matrix = PolyphonicVAE.pr_to_pr_matrix(pr, one_hot)
        alpha = 0.25 * 60 / bpm
        notes = []
        for t in range(32):
            for p in range(128):
                if pr_matrix[t, p] >= 1:
                    s = alpha * t + start
                    e = alpha * (t + pr_matrix[t, p]) + start
                    notes.append(pretty_midi.Note(100, int(p), s, e))
        return notes

    @staticmethod
    def pr_to_nmat(pr, one_hot=False):
        pr_matrix = PolyphonicVAE.pr_to_pr_matrix(pr, one_hot)
        notes = []
        for t in range(32):
            for p in range(128):
                if pr_matrix[t, p] >= 1:
                    s = t * 0.25
                    e = (t + pr_matrix[t, p]) * 0.25
                    notes.append(np.array([s, e, p, 100]))
        nmat = np.array(notes)
        return nmat

    @staticmethod
    def load_model(model_path=None):
        raise NotImplementedError

    def add_name(self, name):
        self.name = name

    def recon_loss(self, z, pr,  reduction='mean'):
        raise NotImplementedError

    def kl_loss(self, dist, beta=0.1):
        z_dim = dist.mean.size(-1)
        normal = PolyphonicVAE.standard_normal(z_dim)
        # kl = kl_divergence(dist, normal).sum(axis=-1).mean()
        mu = dist.mean
        logvar = dist.stddev.log()
        beta = 0.1
        kl = np.log(beta) - logvar + (logvar.exp() ** 2 + mu ** 2) / (2 * beta ** 2) - 0.5
        kl = kl.sum(axis=-1).mean()
        return kl



    @staticmethod
    def standard_normal(shape, beta=0.1):
        N = Normal(torch.zeros(shape), beta * torch.ones(shape))
        if torch.cuda.is_available():
            N.loc = N.loc.cuda()
            N.scale = N.scale.cuda()
        return N


class GroundTruth(PolyphonicVAE):

    def count_params(self):
        return 0

    def inference_recon(self, pr, sample=False):
        return (2 - pr.max(-1)[1]).numpy()

    @staticmethod
    def load_model(model_path=None):
        return GroundTruth()
